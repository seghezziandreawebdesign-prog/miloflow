"use client";

import { useQueryClient } from "@tanstack/react-query";
import { KeyRound, Loader2, Lock, LockOpen } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { SbloccaDialog } from "@/components/credenziali/sblocca-dialog";
import { useVault } from "@/components/credenziali/vault-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { cambiaMasterPassword, creaCassaforte } from "@/lib/actions/credenziali";
import {
  cifraCredenziale,
  creaCassaforte as creaParametri,
  decifraCredenziale,
  MasterPasswordErrata,
  sbloccaCassaforte,
} from "@/lib/crypto/vault";
import { createClient } from "@/lib/supabase/client";

const MIN_LUNGHEZZA = 12;

export function CassaforteSettings({ isOwner }: { isOwner: boolean }) {
  const vault = useVault();
  const [sbloccaOpen, setSbloccaOpen] = useState(false);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="size-4" />
          Cassaforte delle password
        </CardTitle>
        <CardDescription>
          Le password dei servizi vengono cifrate nel browser con una master password che non lascia mai questo
          dispositivo. Nel database finiscono solo dati cifrati.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {vault.stato === "caricamento" ? (
          <p className="text-sm text-muted-foreground">Caricamento…</p>
        ) : vault.stato === "non_configurata" ? (
          isOwner ? (
            <CreaCassaforte onCreata={vault.ricarica} />
          ) : (
            <p className="text-sm text-muted-foreground">La cassaforte non è ancora stata configurata dall&apos;owner.</p>
          )
        ) : (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-1.5 text-sm">
                {vault.stato === "sbloccata" ? (
                  <LockOpen className="size-4 text-emerald-700" />
                ) : (
                  <Lock className="size-4 text-muted-foreground" />
                )}
                {vault.stato === "sbloccata" ? "Sbloccata in questo browser" : "Bloccata"}
              </span>
              {vault.stato === "sbloccata" ? (
                <Button variant="outline" size="sm" onClick={vault.blocca}>
                  Blocca ora
                </Button>
              ) : (
                <Button variant="outline" size="sm" onClick={() => setSbloccaOpen(true)}>
                  Sblocca
                </Button>
              )}
            </div>
            {isOwner && <CambiaMasterPassword onCambiata={vault.ricarica} />}
          </div>
        )}
      </CardContent>
      <SbloccaDialog open={sbloccaOpen} onOpenChange={setSbloccaOpen} />
    </Card>
  );
}

function CreaCassaforte({ onCreata }: { onCreata: () => void }) {
  const [password, setPassword] = useState("");
  const [conferma, setConferma] = useState("");
  const [pending, setPending] = useState(false);
  const errore =
    password && password.length < MIN_LUNGHEZZA
      ? `Almeno ${MIN_LUNGHEZZA} caratteri`
      : conferma && conferma !== password
        ? "Le due password non coincidono"
        : null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (errore || !password || password !== conferma) return;
    setPending(true);
    try {
      const { parametri } = await creaParametri(password);
      const result = await creaCassaforte(parametri);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Cassaforte creata. Sbloccala quando ti serve una password.");
      onCreata();
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="max-w-md">
      <FieldGroup className="gap-4">
        <Field>
          <FieldLabel htmlFor="mp-nuova">Master password</FieldLabel>
          <Input id="mp-nuova" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <FieldDescription>
            Almeno {MIN_LUNGHEZZA} caratteri. Una frase di più parole è la scelta migliore. Se la dimentichi, le password
            cifrate non si possono recuperare: conservala nel tuo password manager.
          </FieldDescription>
        </Field>
        <Field data-invalid={Boolean(errore) || undefined}>
          <FieldLabel htmlFor="mp-conferma">Ripeti la master password</FieldLabel>
          <Input id="mp-conferma" type="password" autoComplete="new-password" value={conferma} onChange={(e) => setConferma(e.target.value)} />
          <FieldError>{errore}</FieldError>
        </Field>
        <Button type="submit" className="w-fit" disabled={pending || Boolean(errore) || !password || password !== conferma}>
          {pending && <Loader2 className="animate-spin" />}
          Crea la cassaforte
        </Button>
      </FieldGroup>
    </form>
  );
}

function CambiaMasterPassword({ onCambiata }: { onCambiata: () => void }) {
  const vault = useVault();
  const queryClient = useQueryClient();
  const [attuale, setAttuale] = useState("");
  const [nuova, setNuova] = useState("");
  const [conferma, setConferma] = useState("");
  const [pending, setPending] = useState(false);
  const [aperto, setAperto] = useState(false);
  const errore =
    nuova && nuova.length < MIN_LUNGHEZZA
      ? `Almeno ${MIN_LUNGHEZZA} caratteri`
      : conferma && conferma !== nuova
        ? "Le due password non coincidono"
        : null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!vault.parametri || errore || nuova !== conferma) return;
    setPending(true);
    try {
      const vecchia = await sbloccaCassaforte(attuale, vault.parametri);
      const { data, error } = await createClient()
        .from("credenziali")
        .select("id, payload_cifrato, iv, salt")
        .eq("tipo", "cifrata");
      if (error) throw error;
      const { parametri, chiave } = await creaParametri(nuova);
      const ricifrate = [];
      for (const c of data) {
        if (!c.payload_cifrato || !c.iv || !c.salt) continue;
        const segreto = await decifraCredenziale(vecchia, { payload_cifrato: c.payload_cifrato, iv: c.iv, salt: c.salt });
        ricifrate.push({ id: c.id, ...(await cifraCredenziale(chiave, segreto)) });
      }
      const result = await cambiaMasterPassword(parametri, ricifrate);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Master password cambiata. ${ricifrate.length} credenziali ricifrate.`);
      setAttuale("");
      setNuova("");
      setConferma("");
      setAperto(false);
      await queryClient.invalidateQueries({ queryKey: ["credenziali"] });
      onCambiata();
    } catch (err) {
      toast.error(err instanceof MasterPasswordErrata ? "La master password attuale è errata" : "Cambio non riuscito");
    } finally {
      setPending(false);
    }
  }

  if (!aperto) {
    return (
      <Button variant="ghost" size="sm" className="-ml-2" onClick={() => setAperto(true)}>
        Cambia master password
      </Button>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="max-w-md border-t pt-4">
      <FieldGroup className="gap-4">
        <Field>
          <FieldLabel htmlFor="mp-attuale">Master password attuale</FieldLabel>
          <Input id="mp-attuale" type="password" autoComplete="off" value={attuale} onChange={(e) => setAttuale(e.target.value)} />
        </Field>
        <Field>
          <FieldLabel htmlFor="mp-cambio">Nuova master password</FieldLabel>
          <Input id="mp-cambio" type="password" autoComplete="new-password" value={nuova} onChange={(e) => setNuova(e.target.value)} />
        </Field>
        <Field data-invalid={Boolean(errore) || undefined}>
          <FieldLabel htmlFor="mp-cambio-conferma">Ripeti la nuova</FieldLabel>
          <Input
            id="mp-cambio-conferma"
            type="password"
            autoComplete="new-password"
            value={conferma}
            onChange={(e) => setConferma(e.target.value)}
          />
          <FieldError>{errore}</FieldError>
          <FieldDescription>Tutte le password cifrate vengono ricifrate in questo browser e salvate insieme.</FieldDescription>
        </Field>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={() => setAperto(false)} disabled={pending}>
            Annulla
          </Button>
          <Button type="submit" disabled={pending || !attuale || !nuova || Boolean(errore) || nuova !== conferma}>
            {pending && <Loader2 className="animate-spin" />}
            Cambia
          </Button>
        </div>
      </FieldGroup>
    </form>
  );
}
