"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Link2, Loader2, Plus, X } from "lucide-react";
import { useState, useTransition } from "react";
import { Controller, useFieldArray, useForm, useWatch, type FieldPath } from "react-hook-form";
import { toast } from "sonner";

import { DatePicker } from "@/components/date-picker";
import { Segmented } from "@/components/segmented";
import { TipoIcona } from "@/components/tipo-icona";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { saveContratto } from "@/lib/actions/contratti";
import { formatCurrency } from "@/lib/dates/format";
import { contrattoSchema, type ContrattoFormValues } from "@/lib/schemas/contratti";
import { parseImporto } from "@/lib/servizi";

import type { OpzioniContratto, ServizioOpzione } from "./use-opzioni-contratto";

export function ContrattoForm({
  contrattoId,
  defaultValues,
  opzioni,
  onSaved,
  onCancel,
}: {
  contrattoId?: string;
  defaultValues: ContrattoFormValues;
  opzioni: OpzioniContratto;
  onSaved: (id: string) => void;
  onCancel: () => void;
}) {
  const isEdit = Boolean(contrattoId);
  const form = useForm<ContrattoFormValues>({ resolver: zodResolver(contrattoSchema), defaultValues });
  const { register, control, handleSubmit, setError, formState, setValue } = form;
  const vociField = useFieldArray({ control, name: "voci" });
  const [saving, startSaving] = useTransition();

  const clienteId = useWatch({ control, name: "cliente_id" });
  const voci = useWatch({ control, name: "voci" });
  const err = formState.errors;
  const servizio = new Map(opzioni.servizi.map((s) => [s.id, s]));

  const onSubmit = handleSubmit((values) =>
    startSaving(async () => {
      const result = await saveContratto(contrattoId ?? null, values);
      if (!result.ok) {
        for (const [field, message] of Object.entries(result.fieldErrors ?? {})) {
          setError(field as FieldPath<ContrattoFormValues>, { message });
        }
        toast.error(result.error);
        return;
      }
      toast.success(isEdit ? "Contratto aggiornato" : "Contratto creato");
      onSaved(result.data.id);
    }),
  );

  // Totale live: la somma dei prezzi delle voci compilate.
  const totale = voci.reduce((sum, v) => {
    const n = parseImporto(v.prezzo);
    return n !== null && !Number.isNaN(n) ? sum + n : sum;
  }, 0);

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <FieldGroup className="gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field data-invalid={Boolean(err.cliente_id) || undefined}>
            <FieldLabel>Cliente</FieldLabel>
            <Controller
              control={control}
              name="cliente_id"
              render={({ field }) => (
                <Select
                  items={opzioni.clienti.map((c) => ({ value: c.id, label: c.nome }))}
                  value={field.value}
                  onValueChange={(v) => v && field.onChange(v)}
                >
                  <SelectTrigger className="w-full" aria-label="Cliente" aria-invalid={Boolean(err.cliente_id) || undefined}>
                    <SelectValue placeholder="Scegli il cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    {opzioni.clienti.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            <FieldError errors={[err.cliente_id]} />
          </Field>
          <Field data-invalid={Boolean(err.titolo) || undefined}>
            <FieldLabel htmlFor="contratto-titolo">Titolo (facoltativo)</FieldLabel>
            <Input
              id="contratto-titolo"
              {...register("titolo")}
              placeholder="es. Gestione completa 2026"
              aria-invalid={Boolean(err.titolo) || undefined}
            />
            <FieldError errors={[err.titolo]} />
          </Field>
        </div>

        <div className="flex flex-wrap items-end gap-4">
          <Controller
            control={control}
            name="stato"
            render={({ field }) => (
              <Segmented
                label="Stato"
                value={field.value}
                onChange={field.onChange}
                opzioni={[
                  { value: "attivo", label: "Attivo" },
                  { value: "concluso", label: "Concluso" },
                ]}
              />
            )}
          />
          <Field className="w-36">
            <FieldLabel>Inizio</FieldLabel>
            <Controller
              control={control}
              name="data_inizio"
              render={({ field }) => <DatePicker value={field.value} onChange={field.onChange} />}
            />
          </Field>
          <Field className="w-36" data-invalid={Boolean(err.data_fine) || undefined}>
            <FieldLabel>Fine</FieldLabel>
            <Controller
              control={control}
              name="data_fine"
              render={({ field }) => (
                <DatePicker value={field.value} onChange={field.onChange} invalid={Boolean(err.data_fine)} />
              )}
            />
            <FieldError errors={[err.data_fine]} />
          </Field>
        </div>

        <Field data-invalid={Boolean(err.voci) || undefined}>
          <FieldLabel>Voci del contratto</FieldLabel>
          <FieldDescription className="mt-0">
            Le prestazioni che fai pagare (es. «Creazione sito web»). A ogni voce puoi collegare i servizi del
            database — dominio, hosting… — come dettaglio, senza prezzo: il totale è la somma delle voci.
          </FieldDescription>
          <div className="space-y-3">
            {vociField.fields.map((f, i) => {
              const collegati = voci[i]?.servizi ?? [];
              return (
                <div key={f.id} className="space-y-2 rounded-lg p-3 ring-1 ring-black/8">
                  <div className="grid grid-cols-[1fr_7rem_2rem] items-start gap-2">
                    <Field data-invalid={Boolean(err.voci?.[i]?.descrizione) || undefined}>
                      <Input
                        {...register(`voci.${i}.descrizione`)}
                        placeholder="es. Creazione sito web, Gestione social media"
                        aria-label="Descrizione della voce"
                        aria-invalid={Boolean(err.voci?.[i]?.descrizione) || undefined}
                      />
                      <FieldError errors={[err.voci?.[i]?.descrizione]} />
                    </Field>
                    <Field data-invalid={Boolean(err.voci?.[i]?.prezzo) || undefined}>
                      <Input
                        {...register(`voci.${i}.prezzo`)}
                        inputMode="decimal"
                        placeholder="€ 0,00"
                        className="text-right tabular-nums"
                        aria-label="Prezzo della voce"
                        aria-invalid={Boolean(err.voci?.[i]?.prezzo) || undefined}
                      />
                      <FieldError errors={[err.voci?.[i]?.prezzo]} />
                    </Field>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="mt-1 justify-self-end text-muted-foreground"
                      onClick={() => vociField.remove(i)}
                      aria-label="Togli la voce"
                    >
                      <X />
                    </Button>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {collegati.map((sid) => {
                      const s = servizio.get(sid);
                      return (
                        <span key={sid} className="inline-flex items-center gap-1 rounded-full bg-muted py-0.5 pr-1 pl-2 text-xs">
                          <TipoIcona nome={s?.tipo_icona ?? null} className="size-3 text-muted-foreground" />
                          {s?.nome ?? "Servizio"}
                          <button
                            type="button"
                            onClick={() =>
                              setValue(
                                `voci.${i}.servizi`,
                                collegati.filter((v) => v !== sid),
                              )
                            }
                            className="rounded-full p-0.5 hover:bg-foreground/10"
                            aria-label={`Scollega ${s?.nome ?? "servizio"}`}
                          >
                            <X className="size-3" />
                          </button>
                        </span>
                      );
                    })}
                    <ServiziPicker
                      opzioni={opzioni.servizi.filter((s) => !collegati.includes(s.id))}
                      clienteId={clienteId}
                      clientiDelServizio={opzioni.clientiDelServizio}
                      vuoto={collegati.length === 0}
                      onSelect={(s) => setValue(`voci.${i}.servizi`, [...collegati, s.id])}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex items-center justify-between gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => vociField.append({ descrizione: "", prezzo: "", servizi: [] })}
            >
              <Plus />
              Aggiungi voce
            </Button>
            <p className="text-sm">
              <span className="text-muted-foreground">Totale · </span>
              <span className="font-semibold tabular-nums">{formatCurrency(totale)}</span>
            </p>
          </div>
          <FieldError errors={[err.voci?.root ?? err.voci]} />
        </Field>

        <Field>
          <FieldLabel htmlFor="contratto-note">Note</FieldLabel>
          <Textarea id="contratto-note" rows={3} {...register("note")} placeholder="Condizioni, accordi, rinnovi…" />
        </Field>
      </FieldGroup>

      <div className="flex justify-end gap-2 border-t pt-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          Annulla
        </Button>
        <Button type="submit" disabled={saving}>
          {saving && <Loader2 className="animate-spin" />}
          {isEdit ? "Salva modifiche" : "Crea contratto"}
        </Button>
      </div>
    </form>
  );
}

/** Collega un servizio del database alla voce, con i servizi del cliente scelto per primi. */
function ServiziPicker({
  opzioni,
  clienteId,
  clientiDelServizio,
  vuoto,
  onSelect,
}: {
  opzioni: ServizioOpzione[];
  clienteId: string;
  clientiDelServizio: Map<string, string[]>;
  /** La voce non ha ancora servizi: etichetta estesa. */
  vuoto: boolean;
  onSelect: (s: ServizioOpzione) => void;
}) {
  const [open, setOpen] = useState(false);
  const delCliente = (s: ServizioOpzione) =>
    Boolean(clienteId && (clientiDelServizio.get(s.id) ?? []).includes(clienteId));
  const ordinati = [...opzioni].sort((a, b) => Number(delCliente(b)) - Number(delCliente(a)) || a.nome.localeCompare(b.nome, "it"));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={<Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-xs text-muted-foreground" />}
      >
        <Link2 className="size-3" />
        {vuoto ? "Collega servizi del database" : "Collega"}
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <Command>
          <CommandInput placeholder="Cerca un servizio…" />
          <CommandList>
            <CommandEmpty>Nessun servizio trovato.</CommandEmpty>
            <CommandGroup>
              {ordinati.map((s) => (
                <CommandItem
                  key={s.id}
                  value={`${s.nome} ${s.id}`}
                  onSelect={() => {
                    onSelect(s);
                    setOpen(false);
                  }}
                >
                  <TipoIcona nome={s.tipo_icona} className="size-4 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate">{s.nome}</span>
                  {delCliente(s) && <span className="text-xs text-muted-foreground">del cliente</span>}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
