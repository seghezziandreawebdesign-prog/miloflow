"use client";

import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from "fflate";
import { DatabaseBackup, Download, Loader2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  cartelleAllegati,
  conteggiBackup,
  fileDalleRighe,
  fileDaVoceZip,
  mimeDaNome,
  nomeFileBackup,
  validaBackup,
  voceZip,
  type BackupDati,
  type FileBackup,
} from "@/lib/backup";
import { todayISO } from "@/lib/dates/format";
import { createClient } from "@/lib/supabase/client";

type Fase = { titolo: string; fatti: number; totali: number } | null;

const LEGGIMI = `Backup di Milo Flow.

dati.json contiene tutte le tabelle (clienti, servizi, credenziali cifrate, task, eventi, budget, debiti, impostazioni).
La cartella file/ contiene i file dello Storage: loghi dei clienti, ricevute delle spese e allegati delle task.

Per ripristinare: su un account Milo Flow nuovo e vuoto vai in Impostazioni → Backup → «Ripristina un backup» e scegli questo file.
Le password cifrate tornano leggibili con la stessa master password.
`;

export function BackupSettings({ vuoto }: { vuoto: boolean }) {
  const [fase, setFase] = useState<Fase>(null);
  const [daRipristinare, setDaRipristinare] = useState<{ file: File; dati: BackupDati; voci: Record<string, Uint8Array> } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const occupato = fase !== null;

  async function esporta() {
    const supabase = createClient();
    try {
      setFase({ titolo: "Lettura dei dati", fatti: 0, totali: 1 });
      const { data, error } = await supabase.rpc("esporta_backup");
      if (error) throw new Error(error.message);
      const valido = validaBackup(data);
      if (!valido.ok) throw new Error(valido.errore);
      const dati = valido.dati;

      // File: loghi e ricevute dalle righe, allegati elencando le cartelle delle task.
      const file: FileBackup[] = fileDalleRighe(dati);
      const cartelle = cartelleAllegati(dati);
      for (const [i, cartella] of cartelle.entries()) {
        setFase({ titolo: "Elenco degli allegati", fatti: i, totali: cartelle.length });
        const { data: voci } = await supabase.storage.from("allegati").list(cartella, { limit: 1000 });
        for (const v of voci ?? []) {
          if (v.id) file.push({ bucket: "allegati", percorso: `${cartella}/${v.name}` });
        }
      }

      const zip: Zippable = {
        "dati.json": [strToU8(JSON.stringify(dati, null, 1)), { level: 6 }],
        "LEGGIMI.txt": strToU8(LEGGIMI),
      };
      let mancanti = 0;
      for (const [i, f] of file.entries()) {
        setFase({ titolo: "Scaricamento dei file", fatti: i, totali: file.length });
        const { data: blob, error: errFile } = await supabase.storage.from(f.bucket).download(f.percorso);
        if (errFile || !blob) {
          mancanti += 1;
          continue;
        }
        // Immagini e PDF sono già compressi: dentro lo ZIP si salvano così come sono.
        zip[voceZip(f)] = [new Uint8Array(await blob.arrayBuffer()), { level: 0 }];
      }

      setFase({ titolo: "Creazione dell'archivio", fatti: 0, totali: 1 });
      const bytes = zipSync(zip);
      const url = URL.createObjectURL(new Blob([bytes], { type: "application/zip" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = nomeFileBackup(todayISO());
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      toast.success(mancanti > 0 ? `Backup pronto: ${file.length - mancanti} file inclusi, ${mancanti} non trovati` : `Backup pronto: ${file.length} file inclusi`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Esportazione non riuscita");
    } finally {
      setFase(null);
    }
  }

  async function leggiFile(f: File) {
    try {
      setFase({ titolo: "Lettura dell'archivio", fatti: 0, totali: 1 });
      const voci = unzipSync(new Uint8Array(await f.arrayBuffer()));
      const json = voci["dati.json"];
      if (!json) throw new Error("Nell'archivio manca dati.json");
      const valido = validaBackup(JSON.parse(strFromU8(json)));
      if (!valido.ok) throw new Error(valido.errore);
      setDaRipristinare({ file: f, dati: valido.dati, voci });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "File non leggibile");
    } finally {
      setFase(null);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function ripristina() {
    if (!daRipristinare) return false;
    const supabase = createClient();
    const { dati, voci } = daRipristinare;
    try {
      setFase({ titolo: "Ripristino dei dati", fatti: 0, totali: 1 });
      const { error } = await supabase.rpc("importa_backup", { p_dati: dati as never });
      if (error) throw new Error(error.message);

      const fileVoci = Object.entries(voci)
        .map(([nome, bytes]) => ({ f: fileDaVoceZip(nome), bytes }))
        .filter((x): x is { f: FileBackup; bytes: Uint8Array } => x.f !== null);
      let falliti = 0;
      for (const [i, { f, bytes }] of fileVoci.entries()) {
        setFase({ titolo: "Caricamento dei file", fatti: i, totali: fileVoci.length });
        const { error: errFile } = await supabase.storage
          .from(f.bucket)
          .upload(f.percorso, bytes as BlobPart, { contentType: mimeDaNome(f.percorso), upsert: true });
        if (errFile) falliti += 1;
      }
      toast.success(falliti > 0 ? `Dati ripristinati; ${falliti} file non caricati` : "Backup ripristinato");
      setDaRipristinare(null);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ripristino non riuscito");
      return false;
    } finally {
      setFase(null);
    }
  }

  return (
    <Card id="backup" className="scroll-mt-20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DatabaseBackup className="size-4" />
          Backup
        </CardTitle>
        <CardDescription>
          Un archivio ZIP con tutti i dati (credenziali cifrate comprese) e i file: loghi, ricevute e allegati. Si ripristina su un
          account Milo Flow nuovo e vuoto. Le password cifrate restano leggibili con la stessa master password.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Button onClick={esporta} disabled={occupato}>
            {occupato ? <Loader2 className="animate-spin" /> : <Download />}
            Scarica il backup
          </Button>
          <input ref={fileInput} type="file" accept=".zip,application/zip" className="sr-only" onChange={(e) => e.target.files?.[0] && void leggiFile(e.target.files[0])} />
          <Button variant="outline" onClick={() => fileInput.current?.click()} disabled={occupato || !vuoto}>
            <Upload />
            Ripristina un backup
          </Button>
        </div>
        {!vuoto && <p className="text-xs text-muted-foreground">Il ripristino è disponibile solo su un account senza dati.</p>}
        {fase && (
          <p className="text-xs text-muted-foreground" role="status">
            {fase.titolo}
            {fase.totali > 1 && ` (${fase.fatti}/${fase.totali})`}…
          </p>
        )}
      </CardContent>

      <ConfirmDialog
        open={daRipristinare !== null}
        onOpenChange={(o) => !o && setDaRipristinare(null)}
        title="Ripristinare questo backup?"
        confirmLabel="Ripristina"
        description={
          daRipristinare
            ? `${daRipristinare.file.name}, generato il ${new Date(daRipristinare.dati.generato_il).toLocaleDateString("it-IT")}: ${conteggiBackup(daRipristinare.dati)
                .map((c) => `${c.righe} ${c.tabella}`)
                .join(", ")}. I dati di esempio di questo account verranno sostituiti.`
            : undefined
        }
        onConfirm={ripristina}
      />
    </Card>
  );
}
