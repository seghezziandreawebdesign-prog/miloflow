"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus, X } from "lucide-react";
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
import { totaliContratto } from "@/lib/queries/contratti";
import { contrattoSchema, type ContrattoFormValues } from "@/lib/schemas/contratti";
import { frequenza, parseImporto } from "@/lib/servizi";
import { cn } from "@/lib/utils";

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
  const { register, control, handleSubmit, setError, formState } = form;
  const righeField = useFieldArray({ control, name: "servizi" });
  const [saving, startSaving] = useTransition();

  const clienteId = useWatch({ control, name: "cliente_id" });
  const righe = useWatch({ control, name: "servizi" });
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

  // Totale live sulle righe compilate.
  const compilate = righe.flatMap((r) => {
    const s = servizio.get(r.servizio_id);
    const prezzo = parseImporto(r.prezzo);
    return s && prezzo !== null && !Number.isNaN(prezzo)
      ? [{ prezzo, frequenza: s.frequenza, costo: s.costo }]
      : [];
  });
  const totali = totaliContratto(compilate);

  function aggiungiServizio(s: ServizioOpzione) {
    // Il prezzo si precompila dal prezzo di rivendita già salvato per il cliente.
    const rivendita = clienteId ? opzioni.prezzoRivendita.get(`${s.id}:${clienteId}`) : undefined;
    righeField.append({
      servizio_id: s.id,
      prezzo: rivendita === undefined ? "" : String(rivendita).replace(".", ","),
    });
  }

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
              placeholder="es. Gestione sito e hosting"
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

        <Field data-invalid={Boolean(err.servizi) || undefined}>
          <FieldLabel>Servizi e prezzi</FieldLabel>
          {righeField.fields.length > 0 && (
            <div className="overflow-hidden rounded-lg ring-1 ring-black/8">
              <div className="hidden grid-cols-[1fr_8rem_6rem_2rem] items-center gap-2 border-b bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground sm:grid">
                <span>Servizio</span>
                <span className="text-right">Prezzo al cliente</span>
                <span className="text-right">Margine</span>
                <span />
              </div>
              <div className="divide-y divide-black/5">
                {righeField.fields.map((f, i) => {
                  const s = servizio.get(righe[i]?.servizio_id ?? "");
                  const prezzoNum = parseImporto(righe[i]?.prezzo ?? "");
                  const margine =
                    s && s.costo !== null && prezzoNum !== null && !Number.isNaN(prezzoNum) ? prezzoNum - s.costo : null;
                  return (
                    <div key={f.id} className="grid grid-cols-[1fr_2rem] items-center gap-2 px-3 py-2 sm:grid-cols-[1fr_8rem_6rem_2rem]">
                      <div className="flex min-w-0 items-center gap-2">
                        <TipoIcona nome={s?.tipo_icona ?? null} className="size-4 shrink-0 text-muted-foreground" />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{s?.nome ?? "Servizio"}</p>
                          <p className="text-xs text-muted-foreground">
                            {s ? frequenza(s.frequenza).label : ""}
                            {s?.costo !== null && s?.costo !== undefined && ` · mi costa ${formatCurrency(s.costo)}`}
                          </p>
                        </div>
                      </div>
                      <div className="order-3 col-span-2 sm:order-none sm:col-span-1">
                        <Input
                          {...register(`servizi.${i}.prezzo`)}
                          inputMode="decimal"
                          placeholder="0,00"
                          className="text-right tabular-nums"
                          aria-label={`Prezzo per ${s?.nome ?? "servizio"}`}
                          aria-invalid={Boolean(err.servizi?.[i]?.prezzo) || undefined}
                        />
                      </div>
                      <span
                        className={cn(
                          "hidden text-right text-xs tabular-nums sm:block",
                          margine === null ? "text-muted-foreground" : margine >= 0 ? "text-emerald-700" : "text-red-700",
                        )}
                      >
                        {margine === null ? "—" : `${margine >= 0 ? "+" : ""}${formatCurrency(margine)}`}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="justify-self-end text-muted-foreground"
                        onClick={() => righeField.remove(i)}
                        aria-label={`Togli ${s?.nome ?? "servizio"}`}
                      >
                        <X />
                      </Button>
                    </div>
                  );
                })}
              </div>
              <div className="flex flex-wrap items-baseline justify-between gap-2 border-t bg-muted/40 px-3 py-2">
                <span className="text-sm font-medium">Totale</span>
                <span className="text-right text-sm">
                  <span className="font-semibold tabular-nums">{formatCurrency(totali.totale_annuo)} l&apos;anno</span>
                  {totali.totale_annuo > 0 && (
                    <span className="text-muted-foreground"> · ≈ {formatCurrency(totali.totale_annuo / 12)} al mese</span>
                  )}
                  {totali.una_tantum > 0 && (
                    <span className="block text-xs text-muted-foreground">
                      più {formatCurrency(totali.una_tantum)} una tantum
                    </span>
                  )}
                </span>
              </div>
            </div>
          )}
          <ServizioPicker
            opzioni={opzioni.servizi.filter((s) => !righe.some((r) => r.servizio_id === s.id))}
            clienteId={clienteId}
            clientiDelServizio={opzioni.clientiDelServizio}
            onSelect={aggiungiServizio}
          />
          <FieldDescription>Il margine è calcolato sul costo di un periodo del servizio.</FieldDescription>
          <FieldError errors={[err.servizi?.root ?? err.servizi]} />
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

/** Scelta di un servizio dal database, con i servizi del cliente scelto per primi. */
function ServizioPicker({
  opzioni,
  clienteId,
  clientiDelServizio,
  onSelect,
}: {
  opzioni: ServizioOpzione[];
  clienteId: string;
  clientiDelServizio: Map<string, string[]>;
  onSelect: (s: ServizioOpzione) => void;
}) {
  const [open, setOpen] = useState(false);
  const delCliente = (s: ServizioOpzione) =>
    Boolean(clienteId && (clientiDelServizio.get(s.id) ?? []).includes(clienteId));
  const ordinati = [...opzioni].sort((a, b) => Number(delCliente(b)) - Number(delCliente(a)) || a.nome.localeCompare(b.nome, "it"));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<Button type="button" variant="outline" size="sm" className="w-fit" />}>
        <Plus />
        Aggiungi servizio
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
                  <span className="text-xs text-muted-foreground">
                    {frequenza(s.frequenza).label}
                    {delCliente(s) && " · del cliente"}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
