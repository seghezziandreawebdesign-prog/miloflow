"use client";

import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Camera, Loader2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { createContext, useContext, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { DatePicker } from "@/components/date-picker";
import { Segmented } from "@/components/segmented";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { saveMovimento, setRicevuta } from "@/lib/actions/budget";
import { nomeFileSicuro } from "@/lib/allegati";
import { ambitoDiDefault, type FiltroAmbito } from "@/lib/ambito";
import { nomeCategoria } from "@/lib/budget";
import { todayISO } from "@/lib/dates/format";
import { movimentoVuoto, type MovimentoFormValues } from "@/lib/schemas/budget";
import { parseImporto } from "@/lib/servizi";
import { createClient } from "@/lib/supabase/client";

import { CampoImporto } from "./campo-importo";
import { CategorieGriglia } from "./categorie-griglia";
import { invalidaBudget, useOpzioniBudget } from "./dati";
import { MetodoSelect } from "./metodo-select";

export const BUCKET_RICEVUTE = "ricevute";
const MAX_RICEVUTA = 10 * 1024 * 1024;

const AMBITI = [
  { value: "lavoro", label: "Lavoro" },
  { value: "personale", label: "Personale" },
] as const;

const STATI = [
  { value: "pagato", label: "Pagata" },
  { value: "previsto", label: "Prevista" },
] as const;

type Richiesta = Partial<MovimentoFormValues>;
type ContextValue = { apri: (richiesta?: Richiesta) => void };
const Context = createContext<ContextValue | null>(null);

/** Apre "Nuova spesa" da qualsiasi punto (menu +, ⌘K, pagina Budget). */
export function useNuovaSpesa() {
  const ctx = useContext(Context);
  if (!ctx) throw new Error("useNuovaSpesa fuori da NuovaSpesaProvider");
  return ctx.apri;
}

export function NuovaSpesaProvider({ filtroAmbito, children }: { filtroAmbito: FiltroAmbito; children: React.ReactNode }) {
  const [richiesta, setRichiesta] = useState<Richiesta | null>(null);
  const [chiave, setChiave] = useState(0);
  return (
    <Context.Provider
      value={{
        apri: (r = {}) => {
          setRichiesta(r);
          setChiave((k) => k + 1);
        },
      }}
    >
      {children}
      {richiesta && (
        <MovimentoDialog
          key={chiave}
          open
          onOpenChange={(o) => !o && setRichiesta(null)}
          defaultValues={{ ...movimentoVuoto(ambitoDiDefault(filtroAmbito), todayISO()), ...richiesta }}
        />
      )}
    </Context.Provider>
  );
}

/** Carica la ricevuta nel bucket privato e la collega al movimento. */
async function caricaRicevuta(movimentoId: string, file: File): Promise<boolean> {
  if (file.size > MAX_RICEVUTA) {
    toast.error("La ricevuta supera i 10 MB");
    return false;
  }
  const path = `${movimentoId}/${nomeFileSicuro(file.name)}`;
  const { error } = await createClient().storage.from(BUCKET_RICEVUTE).upload(path, file, { contentType: file.type || undefined });
  if (error) {
    toast.error(`Ricevuta non caricata: ${error.message}`);
    return false;
  }
  const result = await setRicevuta(movimentoId, path);
  if (!result.ok) toast.error(result.error);
  return result.ok;
}

/**
 * Nuova spesa a passi, pensata per il telefono: importo, poi la griglia delle
 * categorie, poi i dettagli. In modifica mostra tutto insieme.
 */
export function MovimentoDialog({
  open,
  onOpenChange,
  movimentoId = null,
  defaultValues,
  bloccato = false,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  movimentoId?: string | null;
  defaultValues: MovimentoFormValues;
  /** Previsto generato da servizio o rata: importo e ambito seguono l'origine. */
  bloccato?: boolean;
  onSaved?: (id: string) => void;
}) {
  const nuovo = movimentoId === null;
  const [passo, setPasso] = useState<1 | 2 | 3>(nuovo ? 1 : 3);
  const [valori, setValori] = useState<MovimentoFormValues>(defaultValues);
  const [errori, setErrori] = useState<Record<string, string>>({});
  const [ricevuta, setRicevutaFile] = useState<File | null>(null);
  const [pending, startTransition] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);
  const opzioni = useOpzioniBudget(open);
  const queryClient = useQueryClient();
  const router = useRouter();

  const set = <K extends keyof MovimentoFormValues>(k: K, v: MovimentoFormValues[K]) => setValori((x) => ({ ...x, [k]: v }));
  const importoValido = (parseImporto(valori.importo) ?? 0) > 0;
  const categorie = opzioni.data?.categorie ?? [];

  function avanti() {
    if (passo === 1) {
      if (!importoValido) {
        setErrori({ importo: "Inserisci un importo" });
        return;
      }
      setErrori({});
      setPasso(2);
    } else if (passo === 2) {
      setPasso(3);
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await saveMovimento(movimentoId, valori);
      if (!result.ok) {
        setErrori(result.fieldErrors ?? {});
        toast.error(result.error);
        if (result.fieldErrors?.importo) setPasso(nuovo ? 1 : 3);
        return;
      }
      if (ricevuta) await caricaRicevuta(result.data.id, ricevuta);
      toast.success(nuovo ? "Spesa salvata" : "Movimento aggiornato");
      invalidaBudget(queryClient);
      router.refresh();
      onOpenChange(false);
      onSaved?.(result.data.id);
    });
  }

  const titolo = nuovo ? "Nuova spesa" : "Modifica movimento";
  const sottotitolo = nuovo
    ? passo === 1
      ? "Quanto hai speso?"
      : passo === 2
        ? "Per cosa?"
        : "Gli altri dettagli sono facoltativi."
    : bloccato
      ? "Importo e ambito seguono il servizio o la rata da cui nasce."
      : undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2">
            {nuovo && passo > 1 && (
              <Button type="button" variant="ghost" size="icon-sm" aria-label="Indietro" onClick={() => setPasso((p) => (p === 3 ? 2 : 1))}>
                <ArrowLeft />
              </Button>
            )}
            <DialogTitle>{titolo}</DialogTitle>
          </div>
          {sottotitolo && <DialogDescription>{sottotitolo}</DialogDescription>}
        </DialogHeader>

        <form onSubmit={submit} noValidate>
          <FieldGroup className="gap-4">
            {(passo === 1 || !nuovo) && (
              <div className="space-y-3">
                <Field data-invalid={Boolean(errori.importo) || undefined}>
                  {!nuovo && <FieldLabel htmlFor="spesa-importo">Importo</FieldLabel>}
                  <CampoImporto
                    id="spesa-importo"
                    value={valori.importo}
                    onChange={(v) => set("importo", v)}
                    autoFocus={nuovo}
                    invalid={Boolean(errori.importo)}
                    className={bloccato ? "opacity-60" : undefined}
                  />
                  <FieldError>{errori.importo}</FieldError>
                </Field>
                {!bloccato && (
                  <Segmented
                    label=""
                    value={valori.ambito}
                    onChange={(ambito) => set("ambito", ambito)}
                    opzioni={AMBITI}
                    className="flex justify-center"
                  />
                )}
              </div>
            )}

            {(passo === 2 || !nuovo) && (
              <Field>
                {!nuovo && <FieldLabel>Categoria</FieldLabel>}
                {opzioni.isPending ? (
                  <div className="grid h-32 place-items-center text-muted-foreground">
                    <Loader2 className="size-5 animate-spin" />
                  </div>
                ) : (
                  <CategorieGriglia
                    categorie={categorie}
                    ambito={valori.ambito}
                    value={valori.categoria_id}
                    onChange={(id) => {
                      set("categoria_id", id);
                      // Un padre con sottocategorie resta sul passo per mostrarle.
                      const haFiglie = categorie.some((c) => c.parent_id === id && !c.archiviata);
                      if (nuovo && passo === 2 && !haFiglie) setPasso(3);
                    }}
                  />
                )}
              </Field>
            )}

            {passo === 3 && (
              <>
                {nuovo && (
                  <p className="text-sm">
                    <span className="font-semibold tabular-nums">€ {valori.importo}</span>
                    <span className="text-muted-foreground"> · {nomeCategoria(valori.categoria_id, categorie) ?? "Senza categoria"}</span>
                  </p>
                )}
                <Field data-invalid={Boolean(errori.descrizione) || undefined}>
                  <FieldLabel htmlFor="spesa-descrizione">Descrizione</FieldLabel>
                  <Input
                    id="spesa-descrizione"
                    value={valori.descrizione}
                    onChange={(e) => set("descrizione", e.target.value)}
                    placeholder="es. Spesa al supermercato"
                    autoFocus={nuovo}
                  />
                  <FieldError>{errori.descrizione}</FieldError>
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field data-invalid={Boolean(errori.data) || undefined}>
                    <FieldLabel>Data</FieldLabel>
                    <DatePicker value={valori.data} onChange={(v) => set("data", v)} />
                    <FieldError>{errori.data}</FieldError>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="spesa-metodo">Pagato con</FieldLabel>
                    <MetodoSelect
                      id="spesa-metodo"
                      metodi={opzioni.data?.metodi ?? []}
                      ambito={valori.ambito}
                      value={valori.metodo_pagamento_id}
                      onChange={(v) => set("metodo_pagamento_id", v)}
                    />
                  </Field>
                </div>
                {!bloccato && (
                  <Segmented label="Stato" value={valori.stato} onChange={(stato) => set("stato", stato)} opzioni={STATI} />
                )}
                {nuovo && (
                  <Field>
                    <FieldLabel>Ricevuta</FieldLabel>
                    <input
                      ref={fileInput}
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/heic,application/pdf"
                      capture="environment"
                      className="sr-only"
                      onChange={(e) => setRicevutaFile(e.target.files?.[0] ?? null)}
                    />
                    {ricevuta ? (
                      <div className="flex items-center gap-2 rounded-lg bg-muted/60 px-3 py-2 text-sm">
                        <Camera className="size-4 text-muted-foreground" />
                        <span className="min-w-0 flex-1 truncate">{ricevuta.name}</span>
                        <Button type="button" variant="ghost" size="icon-xs" aria-label="Togli la ricevuta" onClick={() => setRicevutaFile(null)}>
                          <X />
                        </Button>
                      </div>
                    ) : (
                      <Button type="button" variant="outline" className="justify-start font-normal" onClick={() => fileInput.current?.click()}>
                        <Camera />
                        Foto o file della ricevuta
                      </Button>
                    )}
                  </Field>
                )}
              </>
            )}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
                Annulla
              </Button>
              {nuovo && passo < 3 ? (
                <Button type="button" onClick={avanti} disabled={passo === 1 && !importoValido}>
                  {passo === 2 && valori.categoria_id === "" ? "Senza categoria" : "Avanti"}
                </Button>
              ) : (
                <Button type="submit" disabled={pending}>
                  {pending && <Loader2 className="animate-spin" />}
                  {nuovo ? "Salva spesa" : "Salva"}
                </Button>
              )}
            </div>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}
