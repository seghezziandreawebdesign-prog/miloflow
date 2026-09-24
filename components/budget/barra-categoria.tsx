"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { saveBudgetMese } from "@/lib/actions/budget";
import { formatMese, type BarraCategoria as Barra, type Categoria } from "@/lib/budget";
import { formatCurrency } from "@/lib/dates/format";
import { cn } from "@/lib/utils";

import { CategoriaIcona } from "./categoria-icona";

/**
 * Una categoria del mese: speso pieno, previsto tratteggiato, rispetto al
 * budget. Rossa se supera. Cliccando si cambia il budget del mese.
 */
export function BarraCategoria({
  barra,
  mese,
  categorie,
  scrittura,
}: {
  barra: Barra;
  mese: string;
  categorie: Categoria[];
  scrittura: boolean;
}) {
  const [open, setOpen] = useState(false);
  const totale = barra.speso + barra.previsto;
  const riferimento = barra.budget ?? totale;
  const pct = (v: number) => (riferimento > 0 ? Math.min(100, (v / riferimento) * 100) : 0);
  const colore = barra.superato ? "var(--destructive)" : (barra.categoria?.colore ?? "var(--primary)");
  const figlieConBudget = barra.categoria
    ? categorie.filter((c) => c.parent_id === barra.categoria!.id && c.budget_default !== null).length
    : 0;

  const contenuto = (
    <>
      <div className="flex items-center gap-2.5">
        <CategoriaIcona nome={barra.categoria?.icona} colore={barra.categoria?.colore} size="sm" />
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{barra.categoria?.nome ?? "Senza categoria"}</span>
        <span className={cn("text-sm tabular-nums", barra.superato && "font-medium text-destructive")}>
          {formatCurrency(barra.speso)}
          {barra.previsto > 0 && <span className="text-muted-foreground"> + {formatCurrency(barra.previsto)}</span>}
          {barra.budget !== null && <span className="text-muted-foreground"> / {formatCurrency(barra.budget)}</span>}
        </span>
      </div>
      <div className="mt-1.5 flex h-2 overflow-hidden rounded-full bg-muted" role="img" aria-label={`Speso ${formatCurrency(barra.speso)}, previsto ${formatCurrency(barra.previsto)}`}>
        <div className="h-full rounded-l-full" style={{ width: `${pct(barra.speso)}%`, backgroundColor: colore }} />
        <div
          className="h-full opacity-60"
          style={{
            width: `${pct(barra.previsto)}%`,
            backgroundImage: `repeating-linear-gradient(135deg, ${colore} 0 4px, transparent 4px 7px)`,
          }}
        />
      </div>
    </>
  );

  return (
    <li>
      {scrittura && barra.categoria ? (
        <button type="button" onClick={() => setOpen(true)} className="block w-full rounded-lg text-left hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none">
          {contenuto}
        </button>
      ) : (
        contenuto
      )}
      {barra.categoria && (
        <BudgetMeseDialog
          open={open}
          onOpenChange={setOpen}
          categoria={barra.categoria}
          mese={mese}
          budgetAttuale={barra.budget}
          personalizzato={barra.personalizzato}
          figlieConBudget={figlieConBudget}
        />
      )}
    </li>
  );
}

function BudgetMeseDialog({
  open,
  onOpenChange,
  categoria,
  mese,
  budgetAttuale,
  personalizzato,
  figlieConBudget,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categoria: Categoria;
  mese: string;
  budgetAttuale: number | null;
  personalizzato: boolean;
  figlieConBudget: number;
}) {
  const [importo, setImporto] = useState(personalizzato && budgetAttuale !== null ? String(budgetAttuale).replace(".", ",") : "");
  const [errore, setErrore] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function salva(valore: string) {
    startTransition(async () => {
      const result = await saveBudgetMese({ categoria_id: categoria.id, mese, importo: valore });
      if (!result.ok) {
        setErrore(result.fieldErrors?.importo ?? result.error);
        return;
      }
      toast.success(valore === "" ? "Budget del mese ripristinato" : "Budget del mese salvato");
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Budget di {categoria.nome}</DialogTitle>
          <DialogDescription>Solo per {formatMese(mese)}. Vuoto = budget di default.</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            salva(importo);
          }}
          noValidate
        >
          <FieldGroup className="gap-4">
            <Field data-invalid={Boolean(errore) || undefined}>
              <FieldLabel htmlFor="budget-mese">Importo (€)</FieldLabel>
              <Input id="budget-mese" value={importo} onChange={(e) => setImporto(e.target.value)} inputMode="decimal" autoFocus placeholder={categoria.budget_default !== null ? String(categoria.budget_default).replace(".", ",") : "0,00"} />
              <FieldError>{errore}</FieldError>
              <FieldDescription>
                Default: {categoria.budget_default !== null ? formatCurrency(categoria.budget_default) : "nessuno"}
                {figlieConBudget > 0 && ` più i budget di ${figlieConBudget} ${figlieConBudget === 1 ? "sottocategoria" : "sottocategorie"}`}.
                Il budget del mese sostituisce tutto.
              </FieldDescription>
            </Field>
            <div className="flex justify-end gap-2">
              {personalizzato && (
                <Button type="button" variant="ghost" onClick={() => salva("")} disabled={pending}>
                  Ripristina
                </Button>
              )}
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
                Annulla
              </Button>
              <Button type="submit" disabled={pending}>
                {pending && <Loader2 className="animate-spin" />}
                Salva
              </Button>
            </div>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}
