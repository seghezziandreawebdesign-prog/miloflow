"use client";

import { useState } from "react";

import { DatePicker } from "@/components/date-picker";
import { SceltaPicker } from "@/components/scelta-picker";
import { Segmented } from "@/components/segmented";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { TaskFormValues } from "@/lib/schemas/task";

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
  | "note"
>;

/**
 * Campi di dettaglio di una task, controllati. Ogni modifica chiama onChange
 * con i soli campi cambiati; i testi al termine della scrittura (blur).
 * Usati dal dialog di creazione e, con salvataggio immediato, dal pannello.
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
        <Field>
          <FieldLabel htmlFor={`${idPrefix}-pianificata`}>Quando la faccio</FieldLabel>
          <DatePicker
            id={`${idPrefix}-pianificata`}
            value={valori.data_pianificata}
            onChange={(v) => onChange({ data_pianificata: v })}
            placeholder="Nessuna data"
            clearable
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={`${idPrefix}-scadenza`}>Scadenza</FieldLabel>
          <DatePicker
            id={`${idPrefix}-scadenza`}
            value={valori.scadenza}
            onChange={(v) => onChange({ scadenza: v })}
            placeholder="Nessuna scadenza"
            clearable
          />
        </Field>
      </div>

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

      <Field>
        <FieldLabel htmlFor={`${idPrefix}-note`}>Note</FieldLabel>
        <TestoAlBlur
          id={`${idPrefix}-note`}
          value={valori.note}
          onCommit={(v) => onChange({ note: v })}
          multiline
          placeholder="Dettagli, link, appunti…"
        />
      </Field>
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
