"use client";

import { useState } from "react";

import { DatePicker } from "@/components/date-picker";
import { EditorTesto } from "@/components/editor-testo-lazy";
import { SceltaPicker } from "@/components/scelta-picker";
import { Segmented } from "@/components/segmented";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { TaskFormValues } from "@/lib/schemas/task";
import { STATI_TASK, type StatoTask } from "@/lib/task";

import type { OpzioniTask } from "./dati";
import { RicorrenzaPicker } from "./ricorrenza-picker";

const PRIORITA_OPZIONI = [
  { value: "", label: "Nessuna" },
  { value: "1", label: "Alta" },
  { value: "2", label: "Media" },
  { value: "3", label: "Bassa" },
] as const;

const AMBITI = [
  { value: "lavoro", label: "Lavoro" },
  { value: "personale", label: "Personale" },
] as const;

type Valori = Pick<
  TaskFormValues,
  | "priorita"
  | "data_pianificata"
  | "scadenza"
  | "ricorrenza"
  | "durata_min"
  | "progetto_id"
  | "cliente_id"
  | "assegnata_a"
  | "ambito"
>;

/**
 * Campi della sezione "Dettagli" di una task, controllati. Ogni modifica
 * chiama onChange con i soli campi cambiati; i testi al termine della
 * scrittura (blur). Usati dal dialog di creazione e dal pannello.
 */
export function CampiTask({
  valori,
  onChange,
  opzioni,
  sottotask = false,
  idPrefix = "task",
}: {
  valori: Valori;
  onChange: (patch: Partial<TaskFormValues>) => void;
  opzioni: OpzioniTask | undefined;
  /** Le sottotask ereditano progetto, cliente e ambito e non si ripetono. */
  sottotask?: boolean;
  idPrefix?: string;
}) {
  const progetto = opzioni?.progetti.find((p) => p.id === valori.progetto_id);
  const clienteDaProgetto = Boolean(progetto?.cliente_id);
  const ambitoBloccato = Boolean(valori.cliente_id) || Boolean(progetto) || clienteDaProgetto;

  return (
    <div className="space-y-4">
      <Segmented
        label="Priorità"
        value={valori.priorita}
        onChange={(v) => onChange({ priorita: v })}
        opzioni={PRIORITA_OPZIONI}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        {!sottotask && (
          <Field>
            <FieldLabel htmlFor={`${idPrefix}-ricorrenza`}>Ricorrenza</FieldLabel>
            <RicorrenzaPicker
              id={`${idPrefix}-ricorrenza`}
              value={valori.ricorrenza}
              onChange={(v) => onChange({ ricorrenza: v })}
              dataRiferimento={valori.data_pianificata || valori.scadenza}
            />
          </Field>
        )}
        <Field>
          <FieldLabel htmlFor={`${idPrefix}-durata`}>Durata (minuti)</FieldLabel>
          <TestoAlBlur
            id={`${idPrefix}-durata`}
            value={valori.durata_min}
            onCommit={(v) => onChange({ durata_min: v.trim() })}
            inputMode="numeric"
            placeholder="es. 30"
          />
        </Field>
      </div>

      {!sottotask && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor={`${idPrefix}-progetto`}>Progetto</FieldLabel>
            <SceltaPicker
              id={`${idPrefix}-progetto`}
              opzioni={opzioni?.progetti ?? []}
              value={valori.progetto_id}
              onChange={(v) => {
                const p = opzioni?.progetti.find((x) => x.id === v);
                onChange({
                  progetto_id: v,
                  ...(p ? { ambito: p.ambito } : {}),
                  ...(p?.cliente_id ? { cliente_id: p.cliente_id } : {}),
                });
              }}
              placeholder="Nessun progetto"
              cerca="Cerca un progetto…"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor={`${idPrefix}-cliente`}>Cliente</FieldLabel>
            <SceltaPicker
              id={`${idPrefix}-cliente`}
              opzioni={opzioni?.clienti ?? []}
              value={valori.cliente_id}
              onChange={(v) => onChange({ cliente_id: v, ...(v ? { ambito: "lavoro" as const } : {}) })}
              placeholder="Nessun cliente"
              cerca="Cerca un cliente…"
              disabled={clienteDaProgetto}
            />
            {clienteDaProgetto && <FieldDescription>Dal progetto.</FieldDescription>}
          </Field>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {(opzioni?.utenti.length ?? 0) > 1 && (
          <Field>
            <FieldLabel htmlFor={`${idPrefix}-assegnata`}>Assegnata a</FieldLabel>
            <SceltaPicker
              id={`${idPrefix}-assegnata`}
              opzioni={opzioni?.utenti ?? []}
              value={valori.assegnata_a}
              onChange={(v) => onChange({ assegnata_a: v })}
              placeholder="Nessuno"
              cerca="Cerca un utente…"
            />
          </Field>
        )}
        {!sottotask && (
          <div>
            <Segmented
              label="Ambito"
              value={valori.ambito}
              onChange={(v) => !ambitoBloccato && onChange({ ambito: v })}
              opzioni={ambitoBloccato ? AMBITI.filter((a) => a.value === valori.ambito) : AMBITI}
            />
            {ambitoBloccato && (
              <p className="mt-1 text-xs text-muted-foreground">
                {valori.cliente_id ? "Con un cliente la task è sempre di lavoro." : "Segue l'ambito del progetto."}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const STATI_OPZIONI = STATI_TASK.map((s) => ({ value: s.value, label: s.label }));

/**
 * Campi in primo piano: descrizione, stato, inizio e scadenza.
 * `onStato` permette al pannello di intercettare "In attesa" e "Fatto".
 */
/** Ora di fine derivata da inizio e durata (la durata resta la fonte di verità). */
function oraFineDa(oraInizio: string, durataMin: string): string {
  const durata = Number(durataMin);
  if (!oraInizio || !durata) return "";
  const [h, m] = oraInizio.split(":").map(Number);
  const tot = h * 60 + m + durata;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(Math.floor(tot / 60) % 24)}:${pad(tot % 60)}`;
}

/** Minuti tra l'ora di inizio e quella di fine; oltre mezzanotte si va al giorno dopo. */
function durataDaOre(oraInizio: string, oraFine: string): string {
  if (!oraInizio || !oraFine) return "";
  const [hi, mi] = oraInizio.split(":").map(Number);
  const [hf, mf] = oraFine.split(":").map(Number);
  let diff = hf * 60 + mf - (hi * 60 + mi);
  if (diff <= 0) diff += 24 * 60;
  return String(diff);
}

export function CampiPrincipali({
  valori,
  onChange,
  onStato,
  aggiornaSubito = false,
  dateDalTesto = {},
  idPrefix = "task",
  senzaDescrizione = false,
}: {
  valori: Pick<TaskFormValues, "note" | "stato" | "in_attesa_di" | "data_pianificata" | "ora_inizio" | "scadenza" | "durata_min">;
  onChange: (patch: Partial<TaskFormValues>) => void;
  onStato?: (stato: StatoTask) => void;
  /** Date riconosciute nel titolo: hanno la precedenza e bloccano il campo. */
  dateDalTesto?: { data_pianificata?: boolean; scadenza?: boolean };
  /** Nel dialog di creazione la descrizione si aggiorna a ogni tasto. */
  aggiornaSubito?: boolean;
  idPrefix?: string;
  /** La descrizione la mostra il chiamante altrove (es. la colonna grande del pannello). */
  senzaDescrizione?: boolean;
}) {
  return (
    <div className="space-y-4">
      {!senzaDescrizione && (
        <Field>
          <FieldLabel htmlFor={`${idPrefix}-descrizione`}>Descrizione</FieldLabel>
          <EditorTesto
            id={`${idPrefix}-descrizione`}
            value={valori.note}
            onChange={(note) => onChange({ note })}
            aggiornaSubito={aggiornaSubito}
          />
        </Field>
      )}

      <Segmented
        label="Stato"
        value={valori.stato}
        opzioni={STATI_OPZIONI}
        onChange={(stato) => (onStato ? onStato(stato) : onChange({ stato }))}
      />
      {aggiornaSubito && valori.stato === "in_attesa" && (
        <Field>
          <FieldLabel htmlFor={`${idPrefix}-attesa`}>In attesa di</FieldLabel>
          <TestoAlBlur
            id={`${idPrefix}-attesa`}
            value={valori.in_attesa_di}
            onCommit={(v) => onChange({ in_attesa_di: v })}
            placeholder="es. risposta del cliente"
          />
        </Field>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor={`${idPrefix}-pianificata`}>Inizio</FieldLabel>
          {/* Se la colonna è stretta le ore scendono sotto la data invece di sovrapporsi. */}
          <div className="flex flex-wrap items-center gap-2">
            <DatePicker
              id={`${idPrefix}-pianificata`}
              value={valori.data_pianificata}
              onChange={(v) => onChange({ data_pianificata: v, ...(v ? {} : { ora_inizio: "" }) })}
              placeholder="Nessuna data"
              clearable
              disabled={dateDalTesto.data_pianificata}
              // Larghezza minima per la data completa: se manca spazio
              // le ore vanno a capo (flex-wrap) invece di coprirla.
              className="min-w-[8.5rem] flex-1"
            />
            <div className="flex items-center gap-1.5">
              <Input
                type="time"
                aria-label="Ora di inizio"
                value={valori.ora_inizio}
                disabled={!valori.data_pianificata}
                onChange={(e) => onChange({ ora_inizio: e.target.value })}
                className="w-[6.5rem] shrink-0"
              />
              <span className="text-xs text-muted-foreground">–</span>
              <Input
                type="time"
                aria-label="Ora di fine"
                // La fine è inizio + durata: cambiandola si riscrive la durata.
                value={oraFineDa(valori.ora_inizio, valori.durata_min)}
                disabled={!valori.data_pianificata || !valori.ora_inizio}
                onChange={(e) => onChange({ durata_min: durataDaOre(valori.ora_inizio, e.target.value) })}
                className="w-[6.5rem] shrink-0"
              />
            </div>
          </div>
          {dateDalTesto.data_pianificata ? (
            <FieldDescription>Presa dal titolo.</FieldDescription>
          ) : valori.data_pianificata && !valori.ora_inizio ? (
            <FieldDescription>Senza ora sta in «tutto il giorno».</FieldDescription>
          ) : (
            valori.ora_inizio &&
            !valori.durata_min && <FieldDescription>Senza fine dura un&apos;ora nel calendario.</FieldDescription>
          )}
        </Field>
        <Field>
          <FieldLabel htmlFor={`${idPrefix}-scadenza`}>Scadenza</FieldLabel>
          <DatePicker
            id={`${idPrefix}-scadenza`}
            value={valori.scadenza}
            onChange={(v) => onChange({ scadenza: v })}
            placeholder="Nessuna scadenza"
            clearable
            disabled={dateDalTesto.scadenza}
          />
          {dateDalTesto.scadenza && <FieldDescription>Presa dal titolo.</FieldDescription>}
        </Field>
      </div>
    </div>
  );
}

/** Campo di testo che notifica il valore solo quando si esce dal campo. */
export function TestoAlBlur({
  value,
  onCommit,
  multiline,
  ...props
}: {
  value: string;
  onCommit: (value: string) => void;
  multiline?: boolean;
  id?: string;
  placeholder?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  className?: string;
  "aria-label"?: string;
}) {
  const [bozza, setBozza] = useState(value);
  const [origine, setOrigine] = useState(value);
  // Se il valore cambia da fuori (salvataggio, altra scheda), riparte da lì.
  if (value !== origine) {
    setOrigine(value);
    setBozza(value);
  }
  const commit = () => {
    if (bozza !== value) onCommit(bozza);
  };
  if (multiline) {
    return (
      <Textarea
        {...props}
        value={bozza}
        rows={4}
        onChange={(e) => setBozza(e.target.value)}
        onBlur={commit}
      />
    );
  }
  return (
    <Input
      {...props}
      value={bozza}
      onChange={(e) => setBozza(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
      }}
    />
  );
}
