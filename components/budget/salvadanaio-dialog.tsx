"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { ColorePicker } from "@/components/colore-picker";
import { DatePicker } from "@/components/date-picker";
import { Segmented } from "@/components/segmented";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { saveSalvadanaio } from "@/lib/actions/salvadanai";
import { categorieScegliibili } from "@/lib/budget";
import { formatCurrency } from "@/lib/dates/format";
import { ritmoObiettivo, TIPI_SALVADANAIO } from "@/lib/salvadanai";
import type { SalvadanaioFormValues } from "@/lib/schemas/salvadanai";
import { parseImporto } from "@/lib/servizi";

import { invalidaBudget, useOpzioniBudget } from "./dati";
import { MetodoSelect } from "./metodo-select";

const AMBITI = [
  { value: "personale", label: "Personale" },
  { value: "lavoro", label: "Lavoro" },
] as const;

/** Creazione e modifica di un obiettivo di risparmio o di un investimento. */
export function SalvadanaioDialog({
  open,
  onOpenChange,
  salvadanaioId = null,
  defaultValues,
  saldo = 0,
  oggi,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  salvadanaioId?: string | null;
  defaultValues: SalvadanaioFormValues;
  /** Quanto c'è già dentro (in modifica), per il suggerimento sul piano. */
  saldo?: number;
  oggi: string;
  onSaved?: (id: string) => void;
}) {
  const [v, setV] = useState<SalvadanaioFormValues>(defaultValues);
  const [errori, setErrori] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();
  const opzioni = useOpzioniBudget(open);
  const queryClient = useQueryClient();
  const router = useRouter();

  const investimento = v.tipo === "investimento";
  const tipo = TIPI_SALVADANAIO[v.tipo];
  const set = <K extends keyof SalvadanaioFormValues>(k: K, val: SalvadanaioFormValues[K]) => setV((x) => ({ ...x, [k]: val }));
  const conPiano = (parseImporto(v.importo_mensile) ?? 0) > 0;
  const ritmo = investimento
    ? null
    : ritmoObiettivo({ saldo, obiettivo: parseImporto(v.obiettivo), data_obiettivo: v.data_obiettivo || null }, oggi);

  const categorie = categorieScegliibili(opzioni.data?.categorie ?? [], v.ambito);
  const itemsCategorie = [
    { value: "", label: "Nessuna categoria" },
    ...categorie.flatMap((r) => [
      { value: r.padre.id, label: r.padre.nome },
      ...r.figlie.map((f) => ({ value: f.id, label: `${r.padre.nome} › ${f.nome}` })),
    ]),
  ];

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await saveSalvadanaio(salvadanaioId, v);
      if (!result.ok) {
        setErrori(result.fieldErrors ?? {});
        toast.error(result.error);
        return;
      }
      toast.success(salvadanaioId ? "Modifiche salvate" : investimento ? "Investimento creato" : "Obiettivo creato");
      invalidaBudget(queryClient);
      router.refresh();
      onOpenChange(false);
      onSaved?.(result.data.id);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{salvadanaioId ? `Modifica ${tipo.singolare.toLowerCase()}` : tipo.nuovo}</DialogTitle>
          <DialogDescription>
            {investimento
              ? "Ogni versamento entra nel budget come spesa del mese e fa crescere il totale investito."
              : "Ogni versamento entra nel budget come spesa del mese e si accumula verso l'obiettivo."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} noValidate>
          <FieldGroup className="gap-4">
            <Field data-invalid={Boolean(errori.nome) || undefined}>
              <FieldLabel htmlFor="salvadanaio-nome">Nome</FieldLabel>
              <Input
                id="salvadanaio-nome"
                value={v.nome}
                onChange={(e) => set("nome", e.target.value)}
                placeholder={investimento ? "es. ETF azionario globale" : "es. Viaggio a New York"}
                autoFocus
              />
              <FieldError>{errori.nome}</FieldError>
            </Field>

            {investimento ? (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="salvadanaio-strumento">Fondo o strumento</FieldLabel>
                    <Input
                      id="salvadanaio-strumento"
                      value={v.strumento}
                      onChange={(e) => set("strumento", e.target.value)}
                      placeholder="es. Vanguard FTSE All-World"
                    />
                  </Field>
                  <Field data-invalid={Boolean(errori.isin) || undefined}>
                    <FieldLabel htmlFor="salvadanaio-isin">ISIN</FieldLabel>
                    <Input
                      id="salvadanaio-isin"
                      value={v.isin}
                      onChange={(e) => set("isin", e.target.value.toUpperCase())}
                      placeholder="es. IE00BK5BQT80"
                      autoCapitalize="characters"
                      spellCheck={false}
                    />
                    <FieldError>{errori.isin}</FieldError>
                  </Field>
                </div>
                <Field>
                  <FieldLabel htmlFor="salvadanaio-piattaforma">Piattaforma</FieldLabel>
                  <Input
                    id="salvadanaio-piattaforma"
                    value={v.piattaforma}
                    onChange={(e) => set("piattaforma", e.target.value)}
                    placeholder="es. Scalable, Directa, la tua banca"
                  />
                </Field>
              </>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field data-invalid={Boolean(errori.obiettivo) || undefined}>
                  <FieldLabel htmlFor="salvadanaio-obiettivo">Obiettivo (€)</FieldLabel>
                  <Input
                    id="salvadanaio-obiettivo"
                    value={v.obiettivo}
                    onChange={(e) => set("obiettivo", e.target.value)}
                    inputMode="decimal"
                    placeholder="es. 3000"
                  />
                  <FieldError>{errori.obiettivo}</FieldError>
                </Field>
                <Field>
                  <FieldLabel>Entro il</FieldLabel>
                  <DatePicker value={v.data_obiettivo} onChange={(d) => set("data_obiettivo", d)} placeholder="Nessuna data" clearable />
                </Field>
              </div>
            )}

            <section className="space-y-3 rounded-lg bg-muted/40 p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">Versamento mensile</p>
                  <p className="text-xs text-muted-foreground">
                    Facoltativo. Ogni mese compare nel budget come spesa prevista: quando la segni pagata, si aggiunge qui.
                  </p>
                </div>
                {conPiano && (
                  <label className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                    <Checkbox checked={v.piano_attivo} onCheckedChange={(c) => set("piano_attivo", c === true)} />
                    Attivo
                  </label>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field data-invalid={Boolean(errori.importo_mensile) || undefined}>
                  <FieldLabel htmlFor="salvadanaio-mensile">Importo al mese (€)</FieldLabel>
                  <Input
                    id="salvadanaio-mensile"
                    value={v.importo_mensile}
                    onChange={(e) => set("importo_mensile", e.target.value)}
                    inputMode="decimal"
                    placeholder={investimento ? "es. 400" : "es. 200"}
                  />
                  <FieldError>{errori.importo_mensile}</FieldError>
                </Field>
                <Field data-invalid={Boolean(errori.giorno_mensile) || undefined}>
                  <FieldLabel htmlFor="salvadanaio-giorno">Giorno del mese</FieldLabel>
                  <Input
                    id="salvadanaio-giorno"
                    value={v.giorno_mensile}
                    onChange={(e) => set("giorno_mensile", e.target.value.replace(/\D/g, "").slice(0, 2))}
                    inputMode="numeric"
                    placeholder="1-28"
                  />
                  <FieldError>{errori.giorno_mensile}</FieldError>
                </Field>
              </div>
              {ritmo?.stato === "in_corso" && (
                <FieldDescription>
                  Per arrivare in tempo servono circa <strong className="text-foreground">{formatCurrency(ritmo.alMese)}</strong> al mese per{" "}
                  {ritmo.mesi === 1 ? "1 mese" : `${ritmo.mesi} mesi`}.
                </FieldDescription>
              )}
            </section>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel>Categoria dei versamenti</FieldLabel>
                <Select items={itemsCategorie} value={v.categoria_id} onValueChange={(c) => set("categoria_id", String(c ?? ""))}>
                  <SelectTrigger className="w-full" aria-label="Categoria">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {itemsCategorie.map((i) => (
                      <SelectItem key={i.value} value={i.value}>
                        {i.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="salvadanaio-metodo">Pagato con</FieldLabel>
                <MetodoSelect
                  id="salvadanaio-metodo"
                  metodi={opzioni.data?.metodi ?? []}
                  ambito={v.ambito}
                  value={v.metodo_pagamento_id}
                  onChange={(m) => set("metodo_pagamento_id", m)}
                />
              </Field>
            </div>

            <Segmented label="Ambito" value={v.ambito} onChange={(a) => set("ambito", a)} opzioni={AMBITI} />

            <Field>
              <FieldLabel>Colore</FieldLabel>
              <ColorePicker value={v.colore} onChange={(c) => set("colore", c)} />
            </Field>

            <Field>
              <FieldLabel htmlFor="salvadanaio-note">Note</FieldLabel>
              <Textarea id="salvadanaio-note" value={v.note} onChange={(e) => set("note", e.target.value)} rows={2} />
            </Field>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
                Annulla
              </Button>
              <Button type="submit" disabled={pending}>
                {pending && <Loader2 className="animate-spin" />}
                {salvadanaioId ? "Salva" : "Crea"}
              </Button>
            </div>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}
