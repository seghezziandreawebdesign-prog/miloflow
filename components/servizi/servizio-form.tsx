"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronDown, Loader2 } from "lucide-react";
import { useState, useTransition } from "react";
import { Controller, useFieldArray, useForm, useWatch, type FieldPath } from "react-hook-form";
import { toast } from "sonner";

import { DatePicker } from "@/components/date-picker";
import { TipoIcona } from "@/components/tipo-icona";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { saveServizio } from "@/lib/actions/servizi";
import { formatCurrency } from "@/lib/dates/format";
import { servizioSchema, type ServizioFormValues } from "@/lib/schemas/servizi";
import { CHI_PAGA, FREQUENZE, parseImporto, STATI_SERVIZIO } from "@/lib/servizi";
import { cn } from "@/lib/utils";

import { ClientiPicker } from "./clienti-picker";
import type { OpzioniServizio } from "./use-opzioni-servizio";

const CAMPI_DETTAGLI: string[] = [
  "ambito", "tipo_id", "fornitore", "rinnovo_automatico", "chi_paga", "metodo_pagamento",
  "preavviso_giorni", "url_pannello", "username", "stato", "note", "clienti",
];

export function ServizioForm({
  servizioId,
  defaultValues,
  opzioni,
  mostraEconomico,
  onSaved,
  onCancel,
}: {
  servizioId?: string;
  defaultValues: ServizioFormValues;
  opzioni: OpzioniServizio;
  /** false per chi non ha il permesso budget: costi e prezzi non si vedono né si salvano. */
  mostraEconomico: boolean;
  onSaved: (id: string) => void;
  onCancel: () => void;
}) {
  const isEdit = Boolean(servizioId);
  const form = useForm<ServizioFormValues>({ resolver: zodResolver(servizioSchema), defaultValues });
  const { register, control, handleSubmit, setError, formState } = form;
  const clientiField = useFieldArray({ control, name: "clienti" });
  const [dettagliAperti, setDettagliAperti] = useState(isEdit);
  const [saving, startSaving] = useTransition();

  const tipoId = useWatch({ control, name: "tipo_id" });
  const frequenza = useWatch({ control, name: "frequenza" });
  const clienti = useWatch({ control, name: "clienti" });
  const costo = useWatch({ control, name: "costo" });
  const tipo = opzioni.tipi.find((t) => t.id === tipoId);
  const nomeCliente = new Map(opzioni.clienti.map((c) => [c.id, c.nome]));
  const err = formState.errors;

  const onSubmit = handleSubmit(
    (values) =>
      startSaving(async () => {
        const result = await saveServizio(servizioId ?? null, values);
        if (!result.ok) {
          for (const [field, message] of Object.entries(result.fieldErrors ?? {})) {
            setError(field as FieldPath<ServizioFormValues>, { message });
            if (CAMPI_DETTAGLI.some((c) => field.startsWith(c))) setDettagliAperti(true);
          }
          toast.error(result.error);
          return;
        }
        toast.success(isEdit ? "Servizio aggiornato" : "Servizio creato");
        onSaved("data" in result ? (result.data as { id: string }).id : (servizioId ?? ""));
      }),
    (errors) => {
      if (Object.keys(errors).some((k) => CAMPI_DETTAGLI.includes(k))) setDettagliAperti(true);
    },
  );

  const costoNum = parseImporto(costo);

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <FieldGroup className="gap-4">
        <Field data-invalid={Boolean(err.nome) || undefined}>
          <FieldLabel htmlFor="servizio-nome">Nome</FieldLabel>
          <Input
            id="servizio-nome"
            {...register("nome")}
            placeholder="es. Dominio esempio.it, Hosting SiteGround"
            autoFocus
            aria-invalid={Boolean(err.nome) || undefined}
          />
          <FieldError errors={[err.nome]} />
        </Field>

        <div className="grid gap-4 sm:grid-cols-3">
          {mostraEconomico && (
            <Field data-invalid={Boolean(err.costo) || undefined}>
              <FieldLabel htmlFor="servizio-costo">Costo (€)</FieldLabel>
              <Input
                id="servizio-costo"
                {...register("costo")}
                inputMode="decimal"
                placeholder="0,00"
                aria-invalid={Boolean(err.costo) || undefined}
              />
              <FieldError errors={[err.costo]} />
            </Field>
          )}
          <Field>
            <FieldLabel>Frequenza</FieldLabel>
            <Controller
              control={control}
              name="frequenza"
              render={({ field }) => (
                <Select items={FREQUENZE} value={field.value} onValueChange={(v) => v && field.onChange(v)}>
                  <SelectTrigger className="w-full" aria-label="Frequenza">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FREQUENZE.map((f) => (
                      <SelectItem key={f.value} value={f.value}>
                        {f.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
          <Field data-invalid={Boolean(err.prossima_scadenza) || undefined}>
            <FieldLabel>{frequenza === "una_tantum" ? "Scadenza" : "Prossima scadenza"}</FieldLabel>
            <Controller
              control={control}
              name="prossima_scadenza"
              render={({ field }) => (
                <DatePicker value={field.value} onChange={field.onChange} invalid={Boolean(err.prossima_scadenza)} />
              )}
            />
            <FieldError errors={[err.prossima_scadenza]} />
          </Field>
        </div>

        <Field>
          <FieldLabel htmlFor="servizio-clienti">Clienti</FieldLabel>
          <ClientiPicker
            id="servizio-clienti"
            opzioni={opzioni.clienti}
            value={clienti.map((c) => c.cliente_id)}
            onChange={(ids) =>
              // Con useFieldArray l'array va sostituito con i suoi metodi, non con setValue.
              clientiField.replace(
                ids.map((id) => clienti.find((c) => c.cliente_id === id) ?? { cliente_id: id, prezzo_rivendita: "" }),
              )
            }
          />
        </Field>
      </FieldGroup>

      <Collapsible open={dettagliAperti} onOpenChange={setDettagliAperti}>
        <CollapsibleTrigger render={<Button type="button" variant="ghost" className="-ml-2 text-muted-foreground" />}>
          <ChevronDown className={cn("transition-transform", dettagliAperti && "rotate-180")} />
          Altri dettagli
        </CollapsibleTrigger>
        <CollapsibleContent>
          <FieldGroup className="mt-3 gap-4">
            <div className="flex flex-wrap gap-4">
              <Controller
                control={control}
                name="ambito"
                render={({ field }) => (
                  <Segmented
                    label="Ambito"
                    value={field.value}
                    onChange={field.onChange}
                    opzioni={[
                      { value: "lavoro", label: "Lavoro" },
                      { value: "personale", label: "Personale" },
                    ]}
                  />
                )}
              />
              <Controller
                control={control}
                name="chi_paga"
                render={({ field }) => (
                  <Segmented label="Chi paga" value={field.value} onChange={field.onChange} opzioni={CHI_PAGA} />
                )}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel>Tipo</FieldLabel>
                <Controller
                  control={control}
                  name="tipo_id"
                  render={({ field }) => (
                    <Select
                      items={[{ value: "", label: "Nessun tipo" }, ...opzioni.tipi.map((t) => ({ value: t.id, label: t.nome }))]}
                      value={field.value}
                      onValueChange={(v) => field.onChange(v ?? "")}
                    >
                      <SelectTrigger className="w-full" aria-label="Tipo">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Nessun tipo</SelectItem>
                        {opzioni.tipi.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            <TipoIcona nome={t.icona} />
                            {t.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
              <Field data-invalid={Boolean(err.preavviso_giorni) || undefined}>
                <FieldLabel htmlFor="servizio-preavviso">Preavviso (giorni)</FieldLabel>
                <Input
                  id="servizio-preavviso"
                  {...register("preavviso_giorni")}
                  inputMode="numeric"
                  placeholder={String(tipo?.preavviso_default ?? 30)}
                  aria-invalid={Boolean(err.preavviso_giorni) || undefined}
                />
                <FieldDescription>
                  Vuoto = {tipo ? `quello del tipo (${tipo.preavviso_default} giorni)` : "30 giorni"}.
                </FieldDescription>
                <FieldError errors={[err.preavviso_giorni]} />
              </Field>
              <Field>
                <FieldLabel htmlFor="servizio-fornitore">Fornitore</FieldLabel>
                <Input id="servizio-fornitore" {...register("fornitore")} placeholder="es. Aruba, SiteGround" />
              </Field>
              {mostraEconomico && (
                <Field data-invalid={Boolean(err.metodo_pagamento) || undefined}>
                  <FieldLabel htmlFor="servizio-metodo">Metodo di pagamento</FieldLabel>
                  <Input
                    id="servizio-metodo"
                    {...register("metodo_pagamento")}
                    placeholder='es. "Revolut *4417"'
                    aria-invalid={Boolean(err.metodo_pagamento) || undefined}
                  />
                  <FieldError errors={[err.metodo_pagamento]} />
                </Field>
              )}
              <Field data-invalid={Boolean(err.url_pannello) || undefined}>
                <FieldLabel htmlFor="servizio-pannello">Pannello di gestione</FieldLabel>
                <Input
                  id="servizio-pannello"
                  {...register("url_pannello")}
                  placeholder="https://…"
                  aria-invalid={Boolean(err.url_pannello) || undefined}
                />
                <FieldError errors={[err.url_pannello]} />
              </Field>
              <Field>
                <FieldLabel htmlFor="servizio-username">Username</FieldLabel>
                <Input id="servizio-username" {...register("username")} autoComplete="off" />
              </Field>
              <Field>
                <FieldLabel>Stato</FieldLabel>
                <Controller
                  control={control}
                  name="stato"
                  render={({ field }) => (
                    <Select items={STATI_SERVIZIO} value={field.value} onValueChange={(v) => v && field.onChange(v)}>
                      <SelectTrigger className="w-full" aria-label="Stato">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATI_SERVIZIO.map((s) => (
                          <SelectItem key={s.value} value={s.value}>
                            {s.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
              <Field orientation="horizontal" className="self-end pb-2">
                <Controller
                  control={control}
                  name="rinnovo_automatico"
                  render={({ field }) => (
                    <Checkbox
                      id="servizio-auto"
                      aria-label="Rinnovo automatico"
                      checked={field.value}
                      onCheckedChange={(v) => field.onChange(v === true)}
                    />
                  )}
                />
                <FieldLabel htmlFor="servizio-auto" className="font-normal">
                  Rinnovo automatico
                </FieldLabel>
              </Field>
            </div>

            {mostraEconomico && clientiField.fields.length > 0 && (
              <Field>
                <FieldLabel>Prezzo di rivendita per cliente</FieldLabel>
                <div className="space-y-2">
                  {clientiField.fields.map((f, i) => {
                    const prezzo = parseImporto(clienti[i]?.prezzo_rivendita ?? "");
                    const margine =
                      prezzo !== null && !Number.isNaN(prezzo) && costoNum !== null && !Number.isNaN(costoNum)
                        ? prezzo - costoNum
                        : null;
                    return (
                      <div key={f.id} className="grid grid-cols-[1fr_7rem_6rem] items-center gap-2">
                        <span className="truncate text-sm">{nomeCliente.get(f.cliente_id) ?? "Cliente"}</span>
                        <Input
                          {...register(`clienti.${i}.prezzo_rivendita`)}
                          inputMode="decimal"
                          placeholder="€"
                          aria-label={`Prezzo di rivendita per ${nomeCliente.get(f.cliente_id) ?? "cliente"}`}
                          aria-invalid={Boolean(err.clienti?.[i]?.prezzo_rivendita) || undefined}
                        />
                        <span
                          className={cn(
                            "text-right text-xs tabular-nums",
                            margine === null ? "text-muted-foreground" : margine >= 0 ? "text-emerald-700" : "text-red-700",
                          )}
                        >
                          {margine === null ? "—" : `${margine >= 0 ? "+" : ""}${formatCurrency(margine)}`}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <FieldDescription>Il margine è calcolato sul costo di un periodo.</FieldDescription>
              </Field>
            )}

            <Field>
              <FieldLabel htmlFor="servizio-note">Note</FieldLabel>
              <Textarea id="servizio-note" rows={3} {...register("note")} />
            </Field>
          </FieldGroup>
        </CollapsibleContent>
      </Collapsible>

      <div className="flex justify-end gap-2 border-t pt-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          Annulla
        </Button>
        <Button type="submit" disabled={saving}>
          {saving && <Loader2 className="animate-spin" />}
          {isEdit ? "Salva modifiche" : "Crea servizio"}
        </Button>
      </div>
    </form>
  );
}

function Segmented<T extends string>({
  label,
  value,
  onChange,
  opzioni,
}: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  opzioni: readonly { value: T; label: string }[];
}) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{label}</p>
      <div role="radiogroup" aria-label={label} className="inline-flex rounded-lg bg-muted p-0.5">
        {opzioni.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            onClick={() => onChange(o.value)}
            className={cn(
              "rounded-md px-3 py-1 text-sm text-muted-foreground",
              value === o.value && "bg-background font-medium text-foreground shadow-sm",
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
