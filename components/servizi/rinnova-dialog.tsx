"use client";

import { ArrowRight, Loader2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { DatePicker } from "@/components/date-picker";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { rinnovaServizio } from "@/lib/actions/servizi";
import { formatDate, todayISO } from "@/lib/dates/format";
import { scadenzaSuccessiva, type Frequenza } from "@/lib/servizi";

export function RinnovaDialog({
  open,
  onOpenChange,
  servizio,
  mostraImporto,
  onRinnovato,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  servizio: { id: string; nome: string; prossima_scadenza: string; frequenza: Frequenza; costo: number | null };
  mostraImporto: boolean;
  onRinnovato: () => void;
}) {
  const [data, setData] = useState(todayISO());
  const [importo, setImporto] = useState(servizio.costo === null ? "" : String(servizio.costo).replace(".", ","));
  const [errori, setErrori] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();
  const nuova = scadenzaSuccessiva(servizio.prossima_scadenza, servizio.frequenza);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await rinnovaServizio(servizio.id, { data, importo: mostraImporto ? importo : "" });
      if (!result.ok) {
        setErrori(result.fieldErrors ?? {});
        toast.error(result.error);
        return;
      }
      toast.success(`Rinnovato: prossima scadenza ${formatDate((result.data as { scadenza: string }).scadenza)}`);
      onOpenChange(false);
      onRinnovato();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Segna come rinnovato</DialogTitle>
          <DialogDescription>{servizio.nome}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} noValidate>
          <FieldGroup className="gap-4">
            <div className="flex items-center justify-center gap-3 rounded-lg bg-muted/60 p-3 text-sm">
              <span className="text-muted-foreground line-through">{formatDate(servizio.prossima_scadenza)}</span>
              <ArrowRight className="size-4 text-muted-foreground" />
              <span className="font-medium">{nuova ? formatDate(nuova) : "—"}</span>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field data-invalid={Boolean(errori.data) || undefined}>
                <FieldLabel>Data del rinnovo</FieldLabel>
                <DatePicker value={data} onChange={setData} />
                <FieldError>{errori.data}</FieldError>
              </Field>
              {mostraImporto && (
                <Field data-invalid={Boolean(errori.importo) || undefined}>
                  <FieldLabel htmlFor="rinnovo-importo">Importo pagato (€)</FieldLabel>
                  <Input
                    id="rinnovo-importo"
                    value={importo}
                    onChange={(e) => setImporto(e.target.value)}
                    inputMode="decimal"
                    autoFocus
                  />
                  <FieldError>{errori.importo}</FieldError>
                </Field>
              )}
            </div>
            <FieldDescription>
              La scadenza avanza di un periodo e il rinnovo resta nello storico. Se paghi tu, il movimento del mese nel budget diventa pagato con questo importo.
            </FieldDescription>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
                Annulla
              </Button>
              <Button type="submit" disabled={pending || !nuova}>
                {pending && <Loader2 className="animate-spin" />}
                Conferma rinnovo
              </Button>
            </div>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}
