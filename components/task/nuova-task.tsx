"use client";

import { useRouter } from "next/navigation";
import { createContext, useContext, useState } from "react";

import { useApriEntita } from "@/components/drawer/use-apri-entita";
import { EditorTesto } from "@/components/editor-testo-lazy";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { EventoDialog } from "@/components/calendario/evento-dialog";
import { ambitoDiDefault, type FiltroAmbito } from "@/lib/ambito";
import { eventoVuoto, type EventoFormValues } from "@/lib/schemas/eventi";
import { progettoVuoto, taskVuota, type TaskFormValues } from "@/lib/schemas/task";
import { cn } from "@/lib/utils";

import { AllegatiInAttesa, caricaAllegati, preparaFile, useRicezioneFile } from "./allegati";
import { CampiPrincipali, CampiTask } from "./campi-task";
import { useOpzioniTask } from "./dati";
import { CampoAggiuntaRapida, useAggiuntaRapida, type DefaultTask } from "./aggiunta-rapida";
import { ProgettoDialog } from "./progetto-dialog";

type Richiesta = Partial<TaskFormValues> & { apriDopo?: boolean };
type RichiestaProgetto = { cliente_id?: string; parent_id?: string };
type RichiestaEvento = Partial<EventoFormValues>;

type ContextValue = {
  apri: (richiesta?: Richiesta) => void;
  apriProgetto: (richiesta?: RichiestaProgetto) => void;
  apriEvento: (richiesta?: RichiestaEvento) => void;
};

const Context = createContext<ContextValue | null>(null);

function useCreazione() {
  const ctx = useContext(Context);
  if (!ctx) throw new Error("useNuovaTask fuori da NuovaTaskProvider");
  return ctx;
}

/** Apre il dialog "Nuova task" da qualsiasi punto (menu +, ⌘K, pannelli, schede). */
export function useNuovaTask() {
  return useCreazione().apri;
}

/** Apre il dialog "Nuovo progetto" da qualsiasi punto. */
export function useNuovoProgetto() {
  return useCreazione().apriProgetto;
}

/** Apre il dialog "Nuovo evento" da qualsiasi punto (menu +, ⌘K, calendario). */
export function useNuovoEvento() {
  return useCreazione().apriEvento;
}

export function NuovaTaskProvider({
  filtroAmbito,
  children,
}: {
  filtroAmbito: FiltroAmbito;
  children: React.ReactNode;
}) {
  const [richiesta, setRichiesta] = useState<Richiesta | null>(null);
  // Ogni apertura rimonta il dialog, così parte sempre pulito.
  const [chiave, setChiave] = useState(0);
  const [progetto, setProgetto] = useState<RichiestaProgetto | null>(null);
  const [evento, setEvento] = useState<RichiestaEvento | null>(null);
  const router = useRouter();
  const ambito = ambitoDiDefault(filtroAmbito);

  return (
    <Context.Provider
      value={{
        apri: (r = {}) => {
          setRichiesta(r);
          setChiave((k) => k + 1);
        },
        apriProgetto: (r = {}) => {
          setProgetto(r);
          setChiave((k) => k + 1);
        },
        apriEvento: (r = {}) => {
          setEvento(r);
          setChiave((k) => k + 1);
        },
      }}
    >
      {children}
      {richiesta && (
        <NuovaTaskDialog
          key={chiave}
          defaults={{ ambito, ...richiesta }}
          apriDopo={richiesta.apriDopo ?? false}
          onClose={() => setRichiesta(null)}
        />
      )}
      <ProgettoDialog
        key={`progetto-${chiave}`}
        open={progetto !== null}
        onOpenChange={(o) => !o && setProgetto(null)}
        defaultValues={progettoVuoto(ambito, progetto?.cliente_id ?? "", progetto?.parent_id ?? "")}
        onSaved={(id) => router.push(`/task/progetti/${id}`)}
      />
      {evento && (
        <EventoDialog
          key={`evento-${chiave}`}
          open
          onOpenChange={(o) => !o && setEvento(null)}
          defaultValues={eventoVuoto(ambito, evento)}
        />
      )}
    </Context.Provider>
  );
}

function NuovaTaskDialog({
  defaults,
  apriDopo,
  onClose,
}: {
  defaults: DefaultTask;
  apriDopo: boolean;
  onClose: () => void;
}) {
  const [open, setOpen] = useState(true);
  const apriEntita = useApriEntita();
  const { data: opzioni } = useOpzioniTask();
  const [dettagli, setDettagli] = useState<TaskFormValues>(() => ({ ...taskVuota(defaults.ambito), ...defaults }));
  const [allegati, setAllegati] = useState<File[]>([]);
  const stato = useAggiuntaRapida({
    defaults: { ambito: dettagli.ambito, titolo: defaults.titolo },
    onCreated: (id) => {
      setOpen(false);
      // Gli allegati salgono dopo: la cartella della task esiste solo ora.
      if (allegati.length > 0) void caricaAllegati(id, allegati);
      if (apriDopo) apriEntita({ tipo: "task", id });
    },
  });
  const ricezione = useRicezioneFile((files) => setAllegati((a) => [...a, ...preparaFile(files)]));
  const { parsed } = stato;
  const aggiorna = (patch: Partial<TaskFormValues>) => setDettagli((d) => ({ ...d, ...patch }));
  const salva = () => stato.salva(dettagli);

  return (
    <Dialog open={open} onOpenChange={setOpen} onOpenChangeComplete={(o) => !o && onClose()}>
      {/* Stessa finestra quasi a tutto schermo del pannello della task. */}
      <DialogContent
        className={cn(
          "flex max-h-[92svh] flex-col overflow-y-auto sm:h-[90svh] sm:max-h-[90svh] sm:max-w-[min(1200px,95vw)]",
          ricezione.trascinando && "ring-2 ring-primary",
        )}
        {...ricezione.props}
      >
        <DialogHeader className="text-left">
          <DialogTitle>Nuova task</DialogTitle>
          <DialogDescription>
            Nel titolo puoi scrivere date («domani», «ven», «12/10», «entro lunedì»), #cliente o #progetto e
            !alta !media !bassa: hanno la precedenza sui campi qui sotto.
          </DialogDescription>
        </DialogHeader>

        <form
          className="flex min-h-0 flex-col gap-5 lg:flex-1"
          onSubmit={(e) => {
            e.preventDefault();
            salva();
          }}
        >
          {/* Come nel pannello: descrizione a tutta altezza a sinistra, campi a destra. */}
          <div className="grid gap-6 lg:flex-1 lg:grid-cols-[minmax(0,1fr)_minmax(320px,380px)] lg:gap-8">
            <div className="flex min-w-0 flex-col gap-4">
              <Field>
                <FieldLabel htmlFor="nuova-task-titolo">Titolo</FieldLabel>
                <CampoAggiuntaRapida
                  id="nuova-task-titolo"
                  stato={stato}
                  onInvio={salva}
                  autoFocus
                  placeholder="Cosa devi fare?"
                />
              </Field>
              <Field className="lg:flex-1">
                <FieldLabel htmlFor="nuova-task-descrizione">Descrizione</FieldLabel>
                <EditorTesto
                  id="nuova-task-descrizione"
                  value={dettagli.note}
                  onChange={(note) => aggiorna({ note })}
                  aggiornaSubito
                  className="lg:flex-1"
                  classeContenuto="min-h-40 sm:min-h-52 lg:min-h-[calc(90svh-24rem)]"
                />
              </Field>
            </div>

            <div className="min-w-0 space-y-5">
              <CampiPrincipali
                valori={{
                  ...dettagli,
                  data_pianificata: parsed.dataPianificata ?? dettagli.data_pianificata,
                  scadenza: parsed.scadenza ?? dettagli.scadenza,
                }}
                dateDalTesto={{ data_pianificata: Boolean(parsed.dataPianificata), scadenza: Boolean(parsed.scadenza) }}
                onChange={aggiorna}
                aggiornaSubito
                idPrefix="nuova-task"
                senzaDescrizione
              />
              <CampiTask valori={dettagli} onChange={aggiorna} opzioni={opzioni} idPrefix="nuova-task" />
              <AllegatiInAttesa files={allegati} onChange={setAllegati} />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Annulla
            </Button>
            <Button type="submit" disabled={stato.pending || !parsed.titolo}>
              {stato.pending ? "Salvataggio…" : "Crea task"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
