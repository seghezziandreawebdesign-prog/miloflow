"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Controller, useForm, useWatch, type FieldPath } from "react-hook-form";
import { toast } from "sonner";

import { DatePicker } from "@/components/date-picker";
import { SceltaPicker } from "@/components/scelta-picker";
import { Segmented } from "@/components/segmented";
import { useOpzioniTask } from "@/components/task/dati";
import { ColorePicker } from "@/components/colore-picker";
import { RicorrenzaPicker } from "@/components/task/ricorrenza-picker";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { saveEvento } from "@/lib/actions/eventi";
import { eventoSchema, type EventoFormValues } from "@/lib/schemas/eventi";

import { invalidaCalendario } from "./dati";

const AMBITI = [
  { value: "lavoro", label: "Lavoro" },
  { value: "personale", label: "Personale" },
] as const;

export function EventoDialog({
  open,
  onOpenChange,
  eventoId,
  defaultValues,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventoId?: string;
  defaultValues: EventoFormValues;
  onSaved?: (id: string) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{eventoId ? "Modifica evento" : "Nuovo evento"}</DialogTitle>
        </DialogHeader>
        {open && (
          <EventoForm
            eventoId={eventoId}
            defaultValues={defaultValues}
            onSaved={(id) => {
              onOpenChange(false);
              onSaved?.(id);
            }}
            onCancel={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function EventoForm({
  eventoId,
  defaultValues,
  onSaved,
  onCancel,
}: {
  eventoId?: string;
  defaultValues: EventoFormValues;
  onSaved: (id: string) => void;
  onCancel: () => void;
}) {
  const { data: opzioni } = useOpzioniTask();
  const queryClient = useQueryClient();
  const router = useRouter();
  const form = useForm<EventoFormValues>({ resolver: zodResolver(eventoSchema), defaultValues });
  const { register, control, handleSubmit, setError, setValue, formState } = form;
  const tuttoIlGiorno = useWatch({ control, name: "tutto_il_giorno" });
  const clienteId = useWatch({ control, name: "cliente_id" });
  const progettoId = useWatch({ control, name: "progetto_id" });
  const dataInizio = useWatch({ control, name: "data_inizio" });
  const [saving, startSaving] = useTransition();
  const err = formState.errors;
  const progetto = opzioni?.progetti.find((p) => p.id === progettoId);
  const ambitoBloccato = Boolean(clienteId) || Boolean(progetto);

  const onSubmit = handleSubmit((values) =>
    startSaving(async () => {
      const result = await saveEvento(eventoId ?? null, values);
      if (!result.ok) {
        for (const [field, message] of Object.entries(result.fieldErrors ?? {})) {
          setError(field as FieldPath<EventoFormValues>, { message });
        }
        toast.error(result.error);
        return;
      }
      toast.success(eventoId ? "Evento aggiornato" : "Evento creato");
      invalidaCalendario(queryClient);
      void queryClient.invalidateQueries({ queryKey: ["evento", result.data.id] });
      router.refresh();
      onSaved(result.data.id);
    }),
  );

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <FieldGroup className="gap-4">
        <Field data-invalid={Boolean(err.titolo) || undefined}>
          <FieldLabel htmlFor="evento-titolo">Titolo</FieldLabel>
          <Input id="evento-titolo" {...register("titolo")} placeholder="es. Call con Rossi" autoFocus aria-invalid={Boolean(err.titolo) || undefined} />
          <FieldError errors={[err.titolo]} />
        </Field>

        <Controller
          control={control}
          name="tutto_il_giorno"
          render={({ field }) => (
            <Field orientation="horizontal">
              <Checkbox id="evento-giornata" checked={field.value} onCheckedChange={(v) => field.onChange(v === true)} />
              <FieldLabel htmlFor="evento-giornata" className="font-normal">
                Tutto il giorno
              </FieldLabel>
            </Field>
          )}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Field data-invalid={Boolean(err.data_inizio || err.ora_inizio) || undefined}>
            <FieldLabel htmlFor="evento-data-inizio">Inizio</FieldLabel>
            <div className="flex gap-2">
              <Controller
                control={control}
                name="data_inizio"
                render={({ field }) => (
                  <DatePicker id="evento-data-inizio" value={field.value} onChange={field.onChange} className="min-w-0 flex-1" invalid={Boolean(err.data_inizio)} />
                )}
              />
              {!tuttoIlGiorno && (
                <Input type="time" aria-label="Ora di inizio" {...register("ora_inizio")} className="w-28 shrink-0" aria-invalid={Boolean(err.ora_inizio) || undefined} />
              )}
            </div>
            <FieldError errors={[err.data_inizio, err.ora_inizio]} />
          </Field>
          <Field data-invalid={Boolean(err.data_fine || err.ora_fine) || undefined}>
            <FieldLabel htmlFor="evento-data-fine">Fine</FieldLabel>
            <div className="flex gap-2">
              <Controller
                control={control}
                name="data_fine"
                render={({ field }) => (
                  <DatePicker
                    id="evento-data-fine"
                    value={field.value}
                    onChange={field.onChange}
                    placeholder={dataInizio ? "Stesso giorno" : "Nessuna"}
                    clearable
                    className="min-w-0 flex-1"
                    invalid={Boolean(err.data_fine)}
                  />
                )}
              />
              {!tuttoIlGiorno && <Input type="time" aria-label="Ora di fine" {...register("ora_fine")} className="w-28 shrink-0" />}
            </div>
            <FieldError errors={[err.data_fine, err.ora_fine]} />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="evento-luogo">Luogo</FieldLabel>
            <Input id="evento-luogo" {...register("luogo")} placeholder="es. Studio, Milano" />
          </Field>
          <Field data-invalid={Boolean(err.link_call) || undefined}>
            <FieldLabel htmlFor="evento-link">Link della call</FieldLabel>
            <Input id="evento-link" {...register("link_call")} placeholder="https://meet.google.com/…" inputMode="url" />
            <FieldError errors={[err.link_call]} />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="evento-progetto">Progetto</FieldLabel>
            <Controller
              control={control}
              name="progetto_id"
              render={({ field }) => (
                <SceltaPicker
                  id="evento-progetto"
                  opzioni={opzioni?.progetti ?? []}
                  value={field.value}
                  onChange={(v) => {
                    field.onChange(v);
                    const p = opzioni?.progetti.find((x) => x.id === v);
                    if (p) setValue("ambito", p.ambito);
                    if (p?.cliente_id) setValue("cliente_id", p.cliente_id);
                  }}
                  placeholder="Nessun progetto"
                  cerca="Cerca un progetto…"
                />
              )}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="evento-cliente">Cliente</FieldLabel>
            <Controller
              control={control}
              name="cliente_id"
              render={({ field }) => (
                <SceltaPicker
                  id="evento-cliente"
                  opzioni={opzioni?.clienti ?? []}
                  value={field.value}
                  onChange={(v) => {
                    field.onChange(v);
                    if (v) setValue("ambito", "lavoro");
                  }}
                  placeholder="Nessun cliente"
                  cerca="Cerca un cliente…"
                  disabled={Boolean(progetto?.cliente_id)}
                />
              )}
            />
            {progetto?.cliente_id && <FieldDescription>Dal progetto.</FieldDescription>}
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Controller
            control={control}
            name="ambito"
            render={({ field }) => (
              <div>
                <Segmented
                  label="Ambito"
                  value={field.value}
                  onChange={(v) => !ambitoBloccato && field.onChange(v)}
                  opzioni={ambitoBloccato ? AMBITI.filter((a) => a.value === field.value) : AMBITI}
                />
                {ambitoBloccato && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {clienteId ? "Con un cliente è sempre di lavoro." : "Segue l'ambito del progetto."}
                  </p>
                )}
              </div>
            )}
          />
          <Field>
            <FieldLabel htmlFor="evento-ricorrenza">Ricorrenza</FieldLabel>
            <Controller
              control={control}
              name="ricorrenza"
              render={({ field }) => (
                <RicorrenzaPicker id="evento-ricorrenza" value={field.value} onChange={field.onChange} dataRiferimento={dataInizio} />
              )}
            />
          </Field>
        </div>

        <Field>
          <FieldLabel>Colore nel calendario</FieldLabel>
          <Controller control={control} name="colore" render={({ field }) => <ColorePicker value={field.value} onChange={field.onChange} />} />
          <FieldDescription>Senza colore l&apos;evento usa quello dell&apos;ambito.</FieldDescription>
        </Field>

        <Field>
          <FieldLabel htmlFor="evento-note">Note</FieldLabel>
          <Textarea id="evento-note" rows={3} {...register("note")} />
        </Field>
      </FieldGroup>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Annulla
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? "Salvataggio…" : eventoId ? "Salva" : "Crea evento"}
        </Button>
      </div>
    </form>
  );
}
