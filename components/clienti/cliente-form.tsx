"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronDown, Loader2, Search } from "lucide-react";
import { useState, useTransition } from "react";
import { Controller, useForm, useWatch, type FieldPath } from "react-hook-form";
import { toast } from "sonner";

import { TagsInput } from "@/components/tags-input";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createCliente, updateCliente } from "@/lib/actions/clienti";
import { isPaeseVies, PAESI, PALETTE_CLIENTI, STATI_CLIENTE, TIPI_CLIENTE } from "@/lib/clienti";
import { clienteSchema, type ClienteFormValues } from "@/lib/schemas/clienti";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type RisultatoVies =
  | { stato: "trovato"; ragioneSociale: string | null; indirizzo: string | null; cap: string | null; citta: string | null; provincia: string | null }
  | { stato: "senza_dati" }
  | { stato: "non_valida" }
  | { stato: "non_disponibile" };

// Campi nascosti in "Altri dettagli": se uno ha un errore, la sezione si apre.
const CAMPI_DETTAGLI: FieldPath<ClienteFormValues>[] = [
  "codice_fiscale", "codice_sdi", "pec", "indirizzo", "cap", "citta", "provincia",
  "sito", "stato", "colore", "tags", "note",
];

export function ClienteForm({
  clienteId,
  defaultValues,
  tagSuggestions,
  onSaved,
  onCancel,
}: {
  clienteId?: string;
  defaultValues: ClienteFormValues;
  tagSuggestions: string[];
  onSaved: (id: string) => void;
  onCancel: () => void;
}) {
  const isEdit = Boolean(clienteId);
  const form = useForm<ClienteFormValues>({
    resolver: zodResolver(clienteSchema),
    defaultValues,
  });
  const { register, control, handleSubmit, setError, setValue, formState } = form;
  const [dettagliAperti, setDettagliAperti] = useState(isEdit);
  const [saving, startSaving] = useTransition();
  const [vies, setVies] = useState<RisultatoVies | null>(null);
  const [viesLoading, setViesLoading] = useState(false);

  const nazione = useWatch({ control, name: "nazione" });
  const piva = useWatch({ control, name: "piva" });
  const tipo = useWatch({ control, name: "tipo" });

  async function cercaSuVies() {
    setViesLoading(true);
    setVies(null);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.functions.invoke("vies-lookup", { body: { nazione, piva } });
      if (error || !data?.disponibile) {
        setVies({ stato: "non_disponibile" });
      } else if (!data.valida) {
        setVies({ stato: "non_valida" });
      } else if (!data.ragioneSociale && !data.indirizzo) {
        setVies({ stato: "senza_dati" });
      } else {
        setVies({ stato: "trovato", ...data });
      }
    } catch {
      setVies({ stato: "non_disponibile" });
    } finally {
      setViesLoading(false);
    }
  }

  function usaDatiVies(dati: Extract<RisultatoVies, { stato: "trovato" }>) {
    const opts = { shouldDirty: true, shouldValidate: true };
    if (dati.ragioneSociale) setValue("ragione_sociale", dati.ragioneSociale, opts);
    if (dati.indirizzo) setValue("indirizzo", dati.indirizzo, opts);
    if (dati.cap) setValue("cap", dati.cap, opts);
    if (dati.citta) setValue("citta", dati.citta, opts);
    if (dati.provincia) setValue("provincia", dati.provincia, opts);
    setValue("tipo", "azienda", opts);
    if (dati.indirizzo || dati.cap) setDettagliAperti(true);
    setVies(null);
    toast.success("Dati di VIES inseriti: controllali prima di salvare");
  }

  const onSubmit = handleSubmit(
    (values) =>
      startSaving(async () => {
        const result = clienteId ? await updateCliente(clienteId, values) : await createCliente(values);
        if (!result.ok) {
          for (const [field, message] of Object.entries(result.fieldErrors ?? {})) {
            setError(field as FieldPath<ClienteFormValues>, { message });
            if (CAMPI_DETTAGLI.includes(field as FieldPath<ClienteFormValues>)) setDettagliAperti(true);
          }
          toast.error(result.error);
          return;
        }
        toast.success(isEdit ? "Cliente aggiornato" : "Cliente creato");
        onSaved(clienteId ?? ("data" in result ? (result.data as { id: string }).id : ""));
      }),
    (errors) => {
      if (Object.keys(errors).some((k) => CAMPI_DETTAGLI.includes(k as FieldPath<ClienteFormValues>))) {
        setDettagliAperti(true);
      }
    },
  );

  const err = formState.errors;

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      {/* Si parte dalla P.IVA: VIES può compilare il resto. */}
      <div className="space-y-3 rounded-lg bg-muted/50 p-3">
        <div className="grid grid-cols-[8.5rem_1fr] gap-2 sm:grid-cols-[10rem_1fr_auto]">
          <Controller
            control={control}
            name="nazione"
            render={({ field }) => (
              <Select items={PAESI} value={field.value} onValueChange={(v) => field.onChange(v ?? "IT")}>
                <SelectTrigger className="w-full bg-background" aria-label="Paese">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAESI.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          <Input
            {...register("piva")}
            placeholder="Partita IVA"
            aria-label="Partita IVA"
            aria-invalid={Boolean(err.piva) || undefined}
            className="bg-background"
            inputMode={nazione === "IT" ? "numeric" : "text"}
            onKeyDown={(e) => {
              if (e.key === "Enter" && isPaeseVies(nazione) && piva.trim()) {
                e.preventDefault();
                void cercaSuVies();
              }
            }}
          />
          <Button
            type="button"
            variant="secondary"
            className="col-span-2 sm:col-span-1"
            disabled={!isPaeseVies(nazione) || !piva.trim() || viesLoading}
            onClick={cercaSuVies}
          >
            {viesLoading ? <Loader2 className="animate-spin" /> : <Search />}
            Cerca su VIES
          </Button>
        </div>
        {err.piva && <FieldError>{err.piva.message}</FieldError>}
        {vies && <EsitoVies risultato={vies} onUsa={usaDatiVies} onChiudi={() => setVies(null)} />}
      </div>

      <FieldGroup className="gap-4">
        <Controller
          control={control}
          name="tipo"
          render={({ field }) => (
            <div role="radiogroup" aria-label="Tipo di cliente" className="inline-flex w-fit rounded-lg bg-muted p-0.5">
              {TIPI_CLIENTE.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  role="radio"
                  aria-checked={field.value === t.value}
                  onClick={() => field.onChange(t.value)}
                  className={cn(
                    "rounded-md px-3 py-1 text-sm text-muted-foreground",
                    field.value === t.value && "bg-background font-medium text-foreground shadow-sm",
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
          )}
        />

        <Field data-invalid={Boolean(err.ragione_sociale) || undefined}>
          <FieldLabel htmlFor="ragione_sociale">
            {tipo === "privato" ? "Nome e cognome" : "Ragione sociale"}
          </FieldLabel>
          <Input id="ragione_sociale" {...register("ragione_sociale")} aria-invalid={Boolean(err.ragione_sociale) || undefined} />
          <FieldError errors={[err.ragione_sociale]} />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="nome_breve">Nome breve</FieldLabel>
            <Input id="nome_breve" {...register("nome_breve")} placeholder="Come lo chiami di solito" />
          </Field>
          <Field data-invalid={Boolean(err.email) || undefined}>
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <Input id="email" type="email" {...register("email")} aria-invalid={Boolean(err.email) || undefined} />
            <FieldError errors={[err.email]} />
          </Field>
          <Field>
            <FieldLabel htmlFor="telefono">Telefono</FieldLabel>
            <Input id="telefono" type="tel" {...register("telefono")} />
          </Field>
        </div>
      </FieldGroup>

      <Collapsible open={dettagliAperti} onOpenChange={setDettagliAperti}>
        <CollapsibleTrigger
          render={<Button type="button" variant="ghost" className="-ml-2 text-muted-foreground" />}
        >
          <ChevronDown className={cn("transition-transform", dettagliAperti && "rotate-180")} />
          Altri dettagli
        </CollapsibleTrigger>
        <CollapsibleContent>
          <FieldGroup className="mt-3 gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField form={form} name="codice_fiscale" label="Codice fiscale" className="uppercase" />
              <TextField form={form} name="codice_sdi" label="Codice SDI" className="uppercase" />
              <TextField form={form} name="pec" label="PEC" type="email" />
              <TextField form={form} name="sito" label="Sito" placeholder="esempio.it" />
            </div>
            <TextField form={form} name="indirizzo" label="Indirizzo" />
            <div className="grid grid-cols-[6rem_1fr_5rem] gap-3">
              <TextField form={form} name="cap" label="CAP" inputMode={nazione === "IT" ? "numeric" : "text"} />
              <TextField form={form} name="citta" label="Città" />
              <TextField form={form} name="provincia" label="Prov." className="uppercase" />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel>Stato</FieldLabel>
                <Controller
                  control={control}
                  name="stato"
                  render={({ field }) => (
                    <Select items={STATI_CLIENTE} value={field.value} onValueChange={(v) => v && field.onChange(v)}>
                      <SelectTrigger className="w-full" aria-label="Stato">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATI_CLIENTE.map((s) => (
                          <SelectItem key={s.value} value={s.value}>
                            {s.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
              <Field>
                <FieldLabel>Colore</FieldLabel>
                <Controller
                  control={control}
                  name="colore"
                  render={({ field }) => (
                    <div role="radiogroup" aria-label="Colore" className="flex flex-wrap gap-1.5 pt-1">
                      {PALETTE_CLIENTI.map((c) => (
                        <button
                          key={c}
                          type="button"
                          role="radio"
                          aria-checked={field.value === c}
                          aria-label={c}
                          onClick={() => field.onChange(field.value === c ? "" : c)}
                          className={cn(
                            "size-6 rounded-full ring-offset-2 ring-offset-background",
                            field.value === c && "ring-2 ring-foreground",
                          )}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                  )}
                />
              </Field>
            </div>

            <Field>
              <FieldLabel htmlFor="tags">Tag</FieldLabel>
              <Controller
                control={control}
                name="tags"
                render={({ field }) => (
                  <TagsInput id="tags" value={field.value} onChange={field.onChange} suggestions={tagSuggestions} />
                )}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="note">Note</FieldLabel>
              <Textarea id="note" rows={3} {...register("note")} />
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
          {isEdit ? "Salva modifiche" : "Crea cliente"}
        </Button>
      </div>
    </form>
  );
}

function TextField({
  form,
  name,
  label,
  className,
  ...inputProps
}: {
  form: ReturnType<typeof useForm<ClienteFormValues>>;
  name: Exclude<FieldPath<ClienteFormValues>, "tags" | `tags.${number}`>;
  label: string;
} & Omit<React.ComponentProps<typeof Input>, "form" | "name">) {
  const error = form.formState.errors[name];
  return (
    <Field data-invalid={Boolean(error) || undefined}>
      <FieldLabel htmlFor={name}>{label}</FieldLabel>
      <Input
        id={name}
        {...form.register(name)}
        aria-invalid={Boolean(error) || undefined}
        className={className}
        {...inputProps}
      />
      <FieldError errors={[error]} />
    </Field>
  );
}

function EsitoVies({
  risultato,
  onUsa,
  onChiudi,
}: {
  risultato: RisultatoVies;
  onUsa: (dati: Extract<RisultatoVies, { stato: "trovato" }>) => void;
  onChiudi: () => void;
}) {
  if (risultato.stato === "trovato") {
    const luogo = [risultato.cap, risultato.citta, risultato.provincia && `(${risultato.provincia})`]
      .filter(Boolean)
      .join(" ");
    return (
      <div className="rounded-md border bg-background p-3">
        <p className="text-xs font-medium text-muted-foreground">Trovato su VIES</p>
        {risultato.ragioneSociale && <p className="mt-1 font-medium">{risultato.ragioneSociale}</p>}
        {risultato.indirizzo && <p className="text-sm text-muted-foreground">{risultato.indirizzo}</p>}
        {luogo && <p className="text-sm text-muted-foreground">{luogo}</p>}
        <div className="mt-3 flex gap-2">
          <Button type="button" size="sm" onClick={() => onUsa(risultato)}>
            Usa questi dati
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={onChiudi}>
            Ignora
          </Button>
        </div>
      </div>
    );
  }

  const messaggi = {
    senza_dati: "P.IVA valida, ma VIES non fornisce nome e indirizzo per questo paese. Compila a mano.",
    non_valida: "Questa P.IVA non risulta attiva su VIES. Controllala: puoi comunque salvare.",
    non_disponibile: "VIES non risponde in questo momento. Puoi continuare a mano.",
  } as const;
  return (
    <p className={cn("text-sm", risultato.stato === "non_valida" ? "text-amber-700" : "text-muted-foreground")}>
      {messaggi[risultato.stato]}
    </p>
  );
}
