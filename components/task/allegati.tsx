"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, FileText, ImagePlus, Loader2, Paperclip, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog, useConfirm } from "@/components/confirm-dialog";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  BUCKET_ALLEGATI,
  formatDimensione,
  isImmagine,
  MAX_ALLEGATO,
  nomeFileSicuro,
  nomeScreenshot,
  nomeVisibile,
} from "@/lib/allegati";
import { formatDate } from "@/lib/dates/format";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const cartella = (taskId: string) => `task/${taskId}`;
const chiave = (taskId: string) => ["allegati", "task", taskId] as const;

type Allegato = {
  percorso: string;
  nome: string;
  dimensione: number;
  tipo: string | null;
  creato: string | null;
  url: string | null;
};

async function leggiAllegati(taskId: string): Promise<Allegato[]> {
  const storage = createClient().storage.from(BUCKET_ALLEGATI);
  const { data, error } = await storage.list(cartella(taskId), {
    limit: 200,
    sortBy: { column: "created_at", order: "asc" },
  });
  if (error) throw new Error(`Lettura allegati non riuscita: ${error.message}`);
  const file = data.filter((f) => f.id && !f.name.startsWith("."));
  const percorsi = file.map((f) => `${cartella(taskId)}/${f.name}`);
  const firmati = percorsi.length ? ((await storage.createSignedUrls(percorsi, 3600)).data ?? []) : [];
  const url = new Map(firmati.flatMap((s) => (s.path && s.signedUrl ? [[s.path, s.signedUrl] as const] : [])));
  return file.map((f, i) => ({
    percorso: percorsi[i],
    nome: nomeVisibile(f.name),
    dimensione: Number(f.metadata?.size ?? 0),
    tipo: (f.metadata?.mimetype as string | undefined) ?? null,
    creato: f.created_at ?? null,
    url: url.get(percorsi[i]) ?? null,
  }));
}

/** Dà un nome utile agli screenshot incollati e scarta i file troppo grandi. */
export function preparaFile(files: File[]): File[] {
  const adesso = new Date();
  const validi: File[] = [];
  for (const f of files) {
    if (f.size > MAX_ALLEGATO) {
      toast.error(`«${f.name}» supera i 25 MB`);
      continue;
    }
    const incollato = /^image\.(png|jpe?g|gif|webp)$/i.test(f.name) || !f.name;
    validi.push(incollato ? new File([f], nomeScreenshot(f.type, adesso), { type: f.type }) : f);
  }
  return validi;
}

/** Carica i file nella cartella della task. Restituisce quanti ne ha caricati. */
export async function caricaAllegati(taskId: string, files: File[]): Promise<number> {
  const storage = createClient().storage.from(BUCKET_ALLEGATI);
  let caricati = 0;
  for (const f of files) {
    const { error } = await storage.upload(`${cartella(taskId)}/${nomeFileSicuro(f.name)}`, f, {
      contentType: f.type || "application/octet-stream",
      upsert: false,
    });
    if (error) toast.error(`«${f.name}» non caricato: ${error.message}`);
    else caricati += 1;
  }
  return caricati;
}

/**
 * Riceve file incollati (⌘V) o trascinati su un contenitore.
 * `props` va steso sul contenitore; `trascinando` serve per evidenziarlo.
 */
export function useRicezioneFile(onFiles: (files: File[]) => void) {
  const [trascinando, setTrascinando] = useState(false);
  const contatore = useRef(0);
  const haFile = (e: React.DragEvent) => Array.from(e.dataTransfer.types).includes("Files");

  return {
    trascinando,
    props: {
      onPaste: (e: React.ClipboardEvent) => {
        const files = Array.from(e.clipboardData.files);
        if (files.length === 0) return;
        e.preventDefault();
        onFiles(files);
      },
      onDragEnter: (e: React.DragEvent) => {
        if (!haFile(e)) return;
        e.preventDefault();
        contatore.current += 1;
        setTrascinando(true);
      },
      onDragOver: (e: React.DragEvent) => {
        if (haFile(e)) e.preventDefault();
      },
      onDragLeave: (e: React.DragEvent) => {
        if (!haFile(e)) return;
        contatore.current -= 1;
        if (contatore.current <= 0) setTrascinando(false);
      },
      onDrop: (e: React.DragEvent) => {
        if (!haFile(e)) return;
        e.preventDefault();
        contatore.current = 0;
        setTrascinando(false);
        onFiles(Array.from(e.dataTransfer.files));
      },
    },
  };
}

/** Allegati di una task: elenco e caricamento, condivisi tra pannello e sezione. */
export function useAllegatiTask(taskId: string) {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: chiave(taskId), queryFn: () => leggiAllegati(taskId) });
  const [caricando, setCaricando] = useState(0);

  async function carica(files: File[]) {
    const validi = preparaFile(files);
    if (validi.length === 0) return;
    setCaricando((n) => n + validi.length);
    const caricati = await caricaAllegati(taskId, validi);
    setCaricando((n) => n - validi.length);
    if (caricati > 0) toast.success(caricati === 1 ? "Allegato caricato" : `${caricati} allegati caricati`);
    void queryClient.invalidateQueries({ queryKey: chiave(taskId) });
  }

  return {
    taskId,
    allegati: query.data,
    isPending: query.isPending,
    caricando,
    carica: (files: File[]) => void carica(files),
    aggiorna: () => void queryClient.invalidateQueries({ queryKey: chiave(taskId) }),
  };
}

/** Sezione allegati del pannello della task. */
export function AllegatiTask({ stato }: { stato: ReturnType<typeof useAllegatiTask> }) {
  const { allegati, isPending, caricando, carica, aggiorna } = stato;
  const [anteprima, setAnteprima] = useState<Allegato | null>(null);
  const conferma = useConfirm<Allegato>();
  const input = useRef<HTMLInputElement>(null);

  const immagini = (allegati ?? []).filter((a) => isImmagine(a.tipo));
  const altri = (allegati ?? []).filter((a) => !isImmagine(a.tipo));

  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-medium">Allegati</h3>
        {(allegati?.length ?? 0) > 0 && <span className="text-xs text-muted-foreground">{allegati?.length}</span>}
        <button
          type="button"
          onClick={() => input.current?.click()}
          className="ml-auto inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <Paperclip className="size-3" />
          Aggiungi file
        </button>
        <input
          ref={input}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            carica(Array.from(e.target.files ?? []));
            e.target.value = "";
          }}
        />
      </div>

      {immagini.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {immagini.map((a) => (
            <div key={a.percorso} className="group relative aspect-square overflow-hidden rounded-lg bg-muted ring-1 ring-foreground/10">
              {a.url && (
                <button type="button" onClick={() => setAnteprima(a)} className="size-full" aria-label={`Apri ${a.nome}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- URL firmato temporaneo, fuori dall'ottimizzatore */}
                  <img src={a.url} alt={a.nome} className="size-full object-cover" loading="lazy" />
                </button>
              )}
              <button
                type="button"
                onClick={() => conferma.ask(a)}
                aria-label={`Elimina ${a.nome}`}
                className="absolute top-1 right-1 grid size-6 place-items-center rounded-md bg-background/90 text-muted-foreground opacity-0 shadow-sm group-hover:opacity-100 hover:text-destructive focus-visible:opacity-100"
              >
                <X className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {altri.length > 0 && (
        <ul className="divide-y rounded-lg ring-1 ring-foreground/10">
          {altri.map((a) => (
            <li key={a.percorso} className="flex items-center gap-2 px-3 py-2 text-sm">
              <FileText className="size-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1">
                <span className="block truncate">{a.nome}</span>
                <span className="block text-xs text-muted-foreground">
                  {formatDimensione(a.dimensione)}
                  {a.creato && ` · ${formatDate(a.creato)}`}
                </span>
              </span>
              {a.url && (
                <a
                  href={a.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Apri ${a.nome}`}
                  className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <Download className="size-4" />
                </a>
              )}
              <button
                type="button"
                onClick={() => conferma.ask(a)}
                aria-label={`Elimina ${a.nome}`}
                className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-destructive"
              >
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {caricando > 0 && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="size-3 animate-spin" />
          Caricamento di {caricando === 1 ? "un file" : `${caricando} file`}…
        </p>
      )}
      {!isPending && (allegati?.length ?? 0) === 0 && caricando === 0 && (
        <button
          type="button"
          onClick={() => input.current?.click()}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed px-3 py-4 text-xs text-muted-foreground hover:bg-muted/50"
        >
          <ImagePlus className="size-4" />
          Trascina qui file e screenshot, oppure incollali con ⌘V
        </button>
      )}

      <Dialog open={anteprima !== null} onOpenChange={(o) => !o && setAnteprima(null)}>
        <DialogContent className="max-h-[92svh] sm:max-w-4xl">
          <DialogTitle className="truncate pr-8 text-sm">{anteprima?.nome}</DialogTitle>
          {anteprima?.url && (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element -- URL firmato temporaneo */}
              <img src={anteprima.url} alt={anteprima.nome} className="max-h-[75svh] w-full rounded-md object-contain" />
              <a href={anteprima.url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">
                Apri l&apos;originale
              </a>
            </>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={conferma.open}
        onOpenChange={conferma.onOpenChange}
        title="Eliminare l'allegato?"
        description={conferma.target ? `«${conferma.target.nome}» verrà eliminato definitivamente.` : undefined}
        onConfirm={async () => {
          if (!conferma.target) return;
          const { error } = await createClient().storage.from(BUCKET_ALLEGATI).remove([conferma.target.percorso]);
          if (error) {
            toast.error("Eliminazione non riuscita");
            return false;
          }
          toast.success("Allegato eliminato");
          aggiorna();
        }}
      />
    </section>
  );
}

/** Allegati scelti nel dialog di creazione, caricati dopo aver creato la task. */
export function AllegatiInAttesa({
  files,
  onChange,
}: {
  files: File[];
  onChange: (files: File[]) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  // URL locali per le miniature, liberati quando i file cambiano.
  const anteprime = useMemo(
    () => new Map(files.filter((f) => isImmagine(f.type)).map((f) => [f, URL.createObjectURL(f)])),
    [files],
  );
  useEffect(() => () => anteprime.forEach((u) => URL.revokeObjectURL(u)), [anteprime]);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">Allegati</span>
        <button
          type="button"
          onClick={() => input.current?.click()}
          className="ml-auto inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <Paperclip className="size-3" />
          Aggiungi file
        </button>
        <input
          ref={input}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            onChange([...files, ...preparaFile(Array.from(e.target.files ?? []))]);
            e.target.value = "";
          }}
        />
      </div>
      {files.length === 0 ? (
        <p className="rounded-lg border border-dashed px-3 py-3 text-center text-xs text-muted-foreground">
          Trascina qui file e screenshot, oppure incollali con ⌘V
        </p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {files.map((f, i) => (
            <li
              key={`${f.name}-${i}`}
              className={cn(
                "flex items-center gap-2 rounded-lg py-1 pr-1 pl-1 text-xs ring-1 ring-foreground/10",
                !anteprime.get(f) && "pl-2",
              )}
            >
              {anteprime.get(f) ? (
                // eslint-disable-next-line @next/next/no-img-element -- anteprima locale
                <img src={anteprime.get(f)} alt="" className="size-8 rounded object-cover" />
              ) : (
                <FileText className="size-4 text-muted-foreground" />
              )}
              <span className="max-w-40 truncate">{f.name}</span>
              <button
                type="button"
                onClick={() => onChange(files.filter((_, j) => j !== i))}
                aria-label={`Togli ${f.name}`}
                className="grid size-6 place-items-center rounded text-muted-foreground hover:bg-muted"
              >
                <X className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
