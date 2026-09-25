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
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { saveProgetto } from "@/lib/actions/task";
import { PALETTE_CLIENTI } from "@/lib/clienti";
import { progettoSchema, type ProgettoFormValues } from "@/lib/schemas/task";
import { STATI_PROGETTO } from "@/lib/task";
import { cn } from "@/lib/utils";

import { invalidaTask, useOpzioniTask } from "./dati";

const AMBITI = [
  { value: "lavoro", label: "Lavoro" },
  { value: "personale", label: "Personale" },
] as const;

export function ProgettoDialog({
  open,
  onOpenChange,
  progettoId,
  defaultValues,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  progettoId?: string;
  defaultValues: ProgettoFormValues;
  onSaved?: (id: string) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{progettoId ? "Modifica progetto" : "Nuovo progetto"}</DialogTitle>
        </DialogHeader>
        {open && (
          <ProgettoForm
            progettoId={progettoId}
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

function ProgettoForm({
  progettoId,
  defaultValues,
  onSaved,
  onCancel,
}: {
  progettoId?: string;
  defaultValues: ProgettoFormValues;
  onSaved: (id: string) => void;
  onCancel: () => void;
}) {
  const { data: opzioni } = useOpzioniTask();
  const queryClient = useQueryClient();
  const router = useRouter();
  const form = useForm<ProgettoFormValues>({ resolver: zodResolver(progettoSchema), defaultValues });
  const { register, control, handleSubmit, setError, formState } = form;
  const clienteId = useWatch({ control, name: "cliente_id" });
  const [saving, startSaving] = useTransition();
  const err = formState.errors;

  // Un solo livello: come padre valgono solo i progetti radice, non se stesso;
  // un progetto che ha già sottoprogetti non può diventare figlio.
  const haFigli = Boolean(progettoId && opzioni?.progetti.some((p) => p.parent_id === progettoId));
  const padri = (opzioni?.progetti ?? []).filter((p) => !p.parent_id && p.id !== progettoId).map((p) => ({ id: p.id, nome: p.nome }));

  const onSubmit = handleSubmit((values) =>
    startSaving(async () => {
      const result = await saveProgetto(progettoId ?? null, values);
      if (!result.ok) {
        for (const [field, message] of Object.entries(result.fieldErrors ?? {})) {
          setError(field as FieldPath<ProgettoFormValues>, { message });
        }
        toast.error(result.error);
        return;
      }
      toast.success(progettoId ? "Progetto aggiornato" : "Progetto creato");
      invalidaTask(queryClient);
      void queryClient.invalidateQueries({ queryKey: ["opzioni-task"] });
      router.refresh();
      onSaved(result.data.id);
    }),
  );

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <FieldGroup className="gap-4">
        <Field data-invalid={Boolean(err.nome) || undefined}>
          <FieldLabel htmlFor="progetto-nome">Nome</FieldLabel>
          <Input
            id="progetto-nome"
            {...register("nome")}
            placeholder="es. Sito Rossi, Trasloco"
            autoFocus
            aria-invalid={Boolean(err.nome) || undefined}
          />
          <FieldError errors={[err.nome]} />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="progetto-cliente">Cliente</FieldLabel>
            <Controller
              control={control}
              name="cliente_id"
              render={({ field }) => (
                <SceltaPicker
                  id="progetto-cliente"
                  opzioni={opzioni?.clienti ?? []}
                  value={field.value}
                  onChange={(v) => {
                    field.onChange(v);
                    if (v) form.setValue("ambito", "lavoro");
                  }}
                  placeholder="Nessun cliente"
                  cerca="Cerca un cliente…"
                />
              )}
            />
          </Field>
          <Field>
            <FieldLabel>Scadenza</FieldLabel>
            <Controller
              control={control}
              name="scadenza"
              render={({ field }) => (
                <DatePicker value={field.value} onChange={field.onChange} placeholder="Nessuna scadenza" clearable />
              )}
            />
          </Field>
        </div>

        {!haFigli && padri.length > 0 && (
          <Field>
            <FieldLabel htmlFor="progetto-padre">Progetto padre</FieldLabel>
            <Controller
              control={control}
              name="parent_id"
              render={({ field }) => (
                <SceltaPicker
                  id="progetto-padre"
                  opzioni={padri}
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="Nessuno: è un progetto principale"
                  cerca="Cerca un progetto…"
                />
              )}
            />
          </Field>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Controller
            control={control}
            name="ambito"
            render={({ field }) => (
              <div>
                <Segmented
                  label="Ambito"
                  value={field.value}
                  onChange={(v) => !clienteId && field.onChange(v)}
                  opzioni={clienteId ? AMBITI.filter((a) => a.value === "lavoro") : AMBITI}
                />
                {clienteId && <p className="mt-1 text-xs text-muted-foreground">Con un cliente è sempre di lavoro.</p>}
              </div>
            )}
          />
          {progettoId && (
            <Controller
              control={control}
              name="stato"
              render={({ field }) => (
                <Segmented label="Stato" value={field.value} onChange={field.onChange} opzioni={STATI_PROGETTO} />
              )}
            />
          )}
        </div>

        <Controller
          control={control}
          name="colore"
          render={({ field }) => (
            <div className="space-y-2">
              <p className="text-sm font-medium">Colore</p>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Colore">
                <button
                  type="button"
                  role="radio"
                  aria-checked={!field.value}
                  aria-label="Nessun colore"
                  onClick={() => field.onChange("")}
                  className={cn(
                    "size-7 rounded-full border bg-background text-xs text-muted-foreground",
                    !field.value && "ring-2 ring-ring ring-offset-2",
                  )}
                >
                  –
                </button>
                {PALETTE_CLIENTI.map((c) => (
                  <button
                    key={c}
                    type="button"
                    role="radio"
                    aria-checked={field.value === c}
                    aria-label={c}
                    onClick={() => field.onChange(c)}
                    className={cn("size-7 rounded-full", field.value === c && "ring-2 ring-ring ring-offset-2")}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          )}
        />

        <Field>
          <FieldLabel htmlFor="progetto-descrizione">Descrizione</FieldLabel>
          <Textarea id="progetto-descrizione" rows={3} {...register("descrizione")} />
        </Field>
      </FieldGroup>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Annulla
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? "Salvataggio…" : progettoId ? "Salva" : "Crea progetto"}
        </Button>
      </div>
    </form>
  );
}
