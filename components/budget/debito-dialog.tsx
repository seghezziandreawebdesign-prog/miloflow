"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Trash2, Wand2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { DatePicker } from "@/components/date-picker";
import { Segmented } from "@/components/segmented";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { saveDebito } from "@/lib/actions/budget";
import { aggiungiMesiData, categorieScegliibili, generaPianoRate, somma, TIPI_DEBITO } from "@/lib/budget";
import { formatCurrency } from "@/lib/dates/format";
import type { DebitoFormValues } from "@/lib/schemas/budget";
import { parseImporto } from "@/lib/servizi";

import { invalidaBudget, useOpzioniBudget } from "./dati";

const AMBITI = [
  { value: "lavoro", label: "Lavoro" },
  { value: "personale", label: "Personale" },
] as const;

/** Creazione e modifica di un debito con il piano delle rate (modificabile). */
export function DebitoDialog({
  open,
  onOpenChange,
  debitoId = null,
  defaultValues,
  ratePagate = [],
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  debitoId?: string | null;
  defaultValues: DebitoFormValues;
  /** Numeri delle rate già pagate: non si toccano. */
  ratePagate?: number[];
  onSaved?: (id: string) => void;
}) {
  const [v, setV] = useState<DebitoFormValues>(defaultValues);
  const [numeroRate, setNumeroRate] = useState(String(Math.max(defaultValues.rate.length, 12)));
  const [primaScadenza, setPrimaScadenza] = useState(defaultValues.rate[0]?.scadenza ?? aggiungiMesiData(defaultValues.data_inizio || new Date().toISOString().slice(0, 10), 1));
  const [errori, setErrori] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();
  const opzioni = useOpzioniBudget(open);
  const queryClient = useQueryClient();
  const router = useRouter();

  const set = <K extends keyof DebitoFormValues>(k: K, val: DebitoFormValues[K]) => setV((x) => ({ ...x, [k]: val }));
  const totale = parseImporto(v.importo_totale) ?? 0;
  const sommaRate = somma(v.rate.map((r) => parseImporto(r.importo) ?? 0));
  const categorie = categorieScegliibili(opzioni.data?.categorie ?? [], v.ambito);
  const itemsCategorie = [
    { value: "", label: "Nessuna categoria" },
    ...categorie.flatMap((r) => [
      { value: r.padre.id, label: r.padre.nome },
      ...r.figlie.map((f) => ({ value: f.id, label: `${r.padre.nome} › ${f.nome}` })),
    ]),
  ];

  function generaPiano() {
    const n = Number(numeroRate);
    if (!(totale > 0) || !(n >= 1)) {
      toast.error("Servono l'importo totale e il numero di rate");
      return;
    }
    const pagate = v.rate.filter((r) => ratePagate.includes(r.numero));
    const residuo = totale - somma(pagate.map((r) => parseImporto(r.importo) ?? 0));
    const nuove = generaPianoRate({ totale: residuo, numeroRate: n - pagate.length, primaScadenza }).map((r) => ({
      numero: r.numero + pagate.length,
      scadenza: r.scadenza,
      importo: String(r.importo).replace(".", ","),
    }));
    set("rate", [...pagate, ...nuove]);
  }

  function aggiornaRata(i: number, patch: Partial<DebitoFormValues["rate"][number]>) {
    set(
      "rate",
      v.rate.map((r, j) => (j === i ? { ...r, ...patch } : r)),
    );
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await saveDebito(debitoId, v);
      if (!result.ok) {
        setErrori(result.fieldErrors ?? {});
        toast.error(result.error);
        return;
      }
      toast.success(debitoId ? "Debito aggiornato" : "Debito creato");
      invalidaBudget(queryClient);
      router.refresh();
      onOpenChange(false);
      onSaved?.(result.data.id);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{debitoId ? "Modifica debito" : "Nuovo debito"}</DialogTitle>
          <DialogDescription>Con il piano delle rate, i previsti entrano nel budget del mese.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} noValidate>
          <FieldGroup className="gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field data-invalid={Boolean(errori.creditore) || undefined}>
                <FieldLabel htmlFor="debito-creditore">Creditore</FieldLabel>
                <Input id="debito-creditore" value={v.creditore} onChange={(e) => set("creditore", e.target.value)} placeholder="es. Banca, concessionaria, un amico" autoFocus />
                <FieldError>{errori.creditore}</FieldError>
              </Field>
              <Field data-invalid={Boolean(errori.importo_totale) || undefined}>
                <FieldLabel htmlFor="debito-totale">Importo totale (€)</FieldLabel>
                <Input id="debito-totale" value={v.importo_totale} onChange={(e) => set("importo_totale", e.target.value)} inputMode="decimal" placeholder="0,00" />
                <FieldError>{errori.importo_totale}</FieldError>
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel>Tipo</FieldLabel>
                <Select items={TIPI_DEBITO} value={v.tipo} onValueChange={(t) => t && set("tipo", t as DebitoFormValues["tipo"])}>
                  <SelectTrigger className="w-full" aria-label="Tipo di debito">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPI_DEBITO.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Segmented label="Ambito" value={v.ambito} onChange={(a) => set("ambito", a)} opzioni={AMBITI} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel>Categoria delle rate</FieldLabel>
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
                <FieldLabel>Data di inizio</FieldLabel>
                <DatePicker value={v.data_inizio} onChange={(d) => set("data_inizio", d)} clearable />
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="debito-descrizione">Descrizione</FieldLabel>
              <Input id="debito-descrizione" value={v.descrizione} onChange={(e) => set("descrizione", e.target.value)} placeholder="es. Finanziamento MacBook" />
            </Field>

            <section className="space-y-3 rounded-lg bg-muted/40 p-3">
              <div className="flex flex-wrap items-end gap-2">
                <Field className="w-24">
                  <FieldLabel htmlFor="debito-n-rate">Rate</FieldLabel>
                  <Input id="debito-n-rate" value={numeroRate} onChange={(e) => setNumeroRate(e.target.value)} inputMode="numeric" />
                </Field>
                <Field className="w-44">
                  <FieldLabel>Prima scadenza</FieldLabel>
                  <DatePicker value={primaScadenza} onChange={setPrimaScadenza} />
                </Field>
                <Button type="button" variant="outline" onClick={generaPiano}>
                  <Wand2 />
                  Genera piano
                </Button>
              </div>
              <FieldDescription>
                Rate mensili uguali dalla prima scadenza; poi puoi correggere date e importi. Le rate pagate restano com&apos;erano.
              </FieldDescription>
              {v.rate.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-xs text-muted-foreground">
                      <tr>
                        <th className="w-10 py-1 text-left font-medium">N.</th>
                        <th className="py-1 text-left font-medium">Scadenza</th>
                        <th className="py-1 text-left font-medium">Importo (€)</th>
                        <th className="w-8" />
                      </tr>
                    </thead>
                    <tbody>
                      {v.rate.map((r, i) => {
                        const pagata = ratePagate.includes(r.numero);
                        return (
                          <tr key={r.numero}>
                            <td className="py-1 tabular-nums">{r.numero}</td>
                            <td className="py-1 pr-2">
                              <DatePicker value={r.scadenza} onChange={(scadenza) => aggiornaRata(i, { scadenza })} disabled={pagata} size="sm" />
                            </td>
                            <td className="py-1 pr-2">
                              <Input value={r.importo} onChange={(e) => aggiornaRata(i, { importo: e.target.value })} inputMode="decimal" disabled={pagata} className="h-8" aria-label={`Importo rata ${r.numero}`} />
                            </td>
                            <td className="py-1">
                              {!pagata && (
                                <Button type="button" variant="ghost" size="icon-xs" aria-label={`Togli la rata ${r.numero}`} onClick={() => set("rate", v.rate.filter((_, j) => j !== i))}>
                                  <Trash2 />
                                </Button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <p className="mt-2 flex justify-between text-xs text-muted-foreground">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 text-primary hover:underline"
                      onClick={() => {
                        const ultima = v.rate[v.rate.length - 1];
                        set("rate", [
                          ...v.rate,
                          { numero: Math.max(0, ...v.rate.map((r) => r.numero)) + 1, scadenza: aggiungiMesiData(ultima.scadenza, 1), importo: ultima.importo },
                        ]);
                      }}
                    >
                      <Plus className="size-3" />
                      Aggiungi rata
                    </button>
                    <span className={sommaRate !== totale && totale > 0 ? "text-destructive" : undefined}>
                      Somma rate {formatCurrency(sommaRate)}
                      {totale > 0 && sommaRate !== totale && ` (totale ${formatCurrency(totale)})`}
                    </span>
                  </p>
                </div>
              )}
              {errori.rate && <p className="text-xs text-destructive">{errori.rate}</p>}
            </section>

            <Field>
              <FieldLabel htmlFor="debito-note">Note</FieldLabel>
              <Textarea id="debito-note" value={v.note} onChange={(e) => set("note", e.target.value)} rows={2} />
            </Field>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
                Annulla
              </Button>
              <Button type="submit" disabled={pending}>
                {pending && <Loader2 className="animate-spin" />}
                {debitoId ? "Salva" : "Crea debito"}
              </Button>
            </div>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}
