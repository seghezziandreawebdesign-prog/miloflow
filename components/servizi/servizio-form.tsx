"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronDown, Loader2, Lock } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { Controller, useFieldArray, useForm, useWatch, type FieldPath } from "react-hook-form";
import { toast } from "sonner";

import { SbloccaDialog } from "@/components/credenziali/sblocca-dialog";
import { useVault } from "@/components/credenziali/vault-provider";
import { DatePicker } from "@/components/date-picker";
import { Segmented } from "@/components/segmented";
import { TipoIcona } from "@/components/tipo-icona";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { saveCredenziale } from "@/lib/actions/credenziali";
import { saveServizio } from "@/lib/actions/servizi";
import { categorieScegliibili } from "@/lib/budget";
import { formatCurrency } from "@/lib/dates/format";
import { etichettaMetodo, tipoMetodo } from "@/lib/metodi-pagamento";
import { servizioSchema, type ServizioFormValues } from "@/lib/schemas/servizi";
import { CHI_PAGA, FREQUENZE, parseImporto, STATI_SERVIZIO } from "@/lib/servizi";
import { cn } from "@/lib/utils";

import { ClientiPicker } from "./clienti-picker";
import type { OpzioniServizio } from "./use-opzioni-servizio";

const CAMPI_DETTAGLI: string[] = [
  "ambito", "tipo_id", "fornitore", "rinnovo_automatico", "preavviso_giorni", "stato", "note", "clienti",
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
  const senzaScadenza = useWatch({ control, name: "senza_scadenza" });
  const clienti = useWatch({ control, name: "clienti" });
  const costo = useWatch({ control, name: "costo" });
  const ambito = useWatch({ control, name: "ambito" });
  const chiPaga = useWatch({ control, name: "chi_paga" });
  const vault = useVault();
  // La password non entra nel form inviato al server: si cifra qui e si salva a parte.
  const [password, setPassword] = useState("");
  const tipo = opzioni.tipi.find((t) => t.id === tipoId);
  const nomeCliente = new Map(opzioni.clienti.map((c) => [c.id, c.nome]));
  const err = formState.errors;

  const onSubmit = handleSubmit(
    (values) =>
      startSaving(async () => {
        if (password && vault.stato !== "sbloccata") {
          toast.error("Sblocca la cassaforte per salvare la password, oppure svuota il campo");
          return;
        }
        const result = await saveServizio(servizioId ?? null, values);
        if (!result.ok) {
          for (const [field, message] of Object.entries(result.fieldErrors ?? {})) {
            setError(field as FieldPath<ServizioFormValues>, { message });
            if (CAMPI_DETTAGLI.some((c) => field.startsWith(c))) setDettagliAperti(true);
          }
          toast.error(result.error);
          return;
        }
        const id = "data" in result ? (result.data as { id: string }).id : (servizioId ?? "");
        if (password) {
          try {
            const cifrata = await vault.cifra(password);
            const cred = await saveCredenziale(
              { servizio_id: id },
              { tipo: "cifrata", etichetta: "Password di accesso", ...cifrata },
            );
            if (!cred.ok) toast.error(`Servizio salvato, ma la password no: ${cred.error}`);
          } catch {
            toast.error("Servizio salvato, ma la cifratura della password non è riuscita");
          }
        }
        toast.success(isEdit ? "Servizio aggiornato" : "Servizio creato");
        onSaved(id);
      }),
    (errors) => {
      if (Object.keys(errors).some((k) => CAMPI_DETTAGLI.includes(k))) setDettagliAperti(true);
    },
  );

  const costoNum = parseImporto(costo);

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(300px,360px)] lg:items-start lg:gap-8">
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
          {!senzaScadenza && (
            <>
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
            </>
          )}
        </div>

        <Field orientation="horizontal">
          <Controller
            control={control}
            name="senza_scadenza"
            render={({ field }) => (
              <Checkbox
                id="servizio-senza-scadenza"
                aria-label="Senza scadenza"
                checked={field.value}
                onCheckedChange={(v) => field.onChange(v === true)}
              />
            )}
          />
          <FieldLabel htmlFor="servizio-senza-scadenza" className="font-normal">
            Senza scadenza (accesso, email, account…)
          </FieldLabel>
        </Field>

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

        {/* Il prezzo che paga il cliente sta accanto al costo, non nei dettagli. */}
        {mostraEconomico && clientiField.fields.length > 0 && (
          <Field>
            <FieldLabel>Prezzo al cliente</FieldLabel>
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
                      aria-label={`Prezzo per ${nomeCliente.get(f.cliente_id) ?? "cliente"}`}
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
            <FieldDescription>Accanto c&apos;è il margine, calcolato sul costo di un periodo.</FieldDescription>
          </Field>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Controller
            control={control}
            name="chi_paga"
            render={({ field }) => (
              <Segmented label="Chi paga" value={field.value} onChange={field.onChange} opzioni={CHI_PAGA} />
            )}
          />
          {mostraEconomico && chiPaga === "io" && (
            <Field>
              <FieldLabel>Pagato con</FieldLabel>
              <Controller
                control={control}
                name="metodo_pagamento_id"
                render={({ field }) => (
                  <Select
                    items={[
                      { value: "", label: "Non indicato" },
                      ...opzioni.metodi.map((m) => ({ value: m.id, label: etichettaMetodo(m) })),
                    ]}
                    value={field.value}
                    onValueChange={(v) => field.onChange(v ?? "")}
                  >
                    <SelectTrigger className="w-full" aria-label="Pagato con">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Non indicato</SelectItem>
                      {opzioni.metodi.map((m) => {
                        const Tipo = tipoMetodo(m.tipo).icon;
                        return (
                          <SelectItem key={m.id} value={m.id}>
                            <Tipo />
                            {etichettaMetodo(m)}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                )}
              />
              <FieldDescription>
                <Link href="/impostazioni#metodi-pagamento" className="underline underline-offset-4">
                  Gestisci carte e metodi
                </Link>
              </FieldDescription>
            </Field>
          )}
        </div>
        {mostraEconomico && chiPaga === "io" && (
          <Field>
            <FieldLabel>Categoria di spesa</FieldLabel>
            <Controller
              control={control}
              name="categoria_spesa_id"
              render={({ field }) => {
                const items = [
                  { value: "", label: "Nessuna categoria" },
                  ...categorieScegliibili(opzioni.categorie, ambito).flatMap((r) => [
                    { value: r.padre.id, label: r.padre.nome },
                    ...r.figlie.map((f) => ({ value: f.id, label: `${r.padre.nome} › ${f.nome}` })),
                  ]),
                ];
                return (
                  <Select items={items} value={field.value} onValueChange={(v) => field.onChange(v ?? "")}>
                    <SelectTrigger className="w-full" aria-label="Categoria di spesa">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {items.map((i) => (
                        <SelectItem key={i.value} value={i.value}>
                          {i.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                );
              }}
            />
            <FieldDescription>I rinnovi e i previsti nel budget finiscono in questa categoria.</FieldDescription>
          </Field>
        )}
      </FieldGroup>

      <div className="space-y-5">
      <fieldset className="space-y-3 rounded-lg border p-3">
        <legend className="px-1 text-sm font-medium">Accesso</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field data-invalid={Boolean(err.url_pannello) || undefined} className="sm:col-span-2">
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
            <FieldLabel htmlFor="servizio-username">Email o username</FieldLabel>
            <Input id="servizio-username" {...register("username")} autoComplete="off" />
          </Field>
          {isEdit ? (
            <p className="self-end pb-2 text-xs text-muted-foreground">
              Le password si aggiungono e si cambiano dal pannello del servizio, sezione Credenziali.
            </p>
          ) : (
            <PasswordField value={password} onChange={setPassword} />
          )}
        </div>
      </fieldset>

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
              {!senzaScadenza && (
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
              )}
              <Field>
                <FieldLabel htmlFor="servizio-fornitore">Fornitore</FieldLabel>
                <Input id="servizio-fornitore" {...register("fornitore")} placeholder="es. Aruba, SiteGround" />
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
              {!senzaScadenza && (
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
              )}
            </div>

            <Field>
              <FieldLabel htmlFor="servizio-note">Note</FieldLabel>
              <Textarea id="servizio-note" rows={3} {...register("note")} />
            </Field>
          </FieldGroup>
        </CollapsibleContent>
      </Collapsible>
      </div>
      </div>

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


/** Password del servizio, cifrata nel browser al salvataggio. Serve la cassaforte sbloccata. */
function PasswordField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const vault = useVault();
  const [sbloccaOpen, setSbloccaOpen] = useState(false);

  if (vault.stato === "non_configurata") {
    return (
      <p className="self-end pb-2 text-xs text-muted-foreground">
        Per salvare password cifrate{" "}
        <Link href="/impostazioni" className="underline underline-offset-4">
          crea la cassaforte
        </Link>
        .
      </p>
    );
  }

  return (
    <Field>
      <FieldLabel htmlFor="servizio-password">Password</FieldLabel>
      {vault.stato === "sbloccata" ? (
        <Input
          id="servizio-password"
          type="password"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete="new-password"
        />
      ) : (
        <Button type="button" variant="outline" onClick={() => setSbloccaOpen(true)} disabled={vault.stato === "caricamento"}>
          <Lock />
          Sblocca la cassaforte per inserirla
        </Button>
      )}
      <FieldDescription>Cifrata in questo browser prima dell&apos;invio.</FieldDescription>
      <SbloccaDialog open={sbloccaOpen} onOpenChange={setSbloccaOpen} />
    </Field>
  );
}
