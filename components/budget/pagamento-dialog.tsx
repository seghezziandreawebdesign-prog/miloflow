"use client";

import { Loader2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { DatePicker } from "@/components/date-picker";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { ActionResult } from "@/lib/actions/types";
import { todayISO } from "@/lib/dates/format";
import type { PagamentoFormValues } from "@/lib/schemas/budget";

import { useOpzioniBudget } from "./dati";
import { MetodoSelect } from "./metodo-select";

/**
 * "Segna pagato" di un previsto o pagamento di una rata: data, importo
 * (precompilato, modificabile) e metodo.
 */
export function PagamentoDialog({
  open,
  onOpenChange,
  titolo,
  descrizione,
  importo,
  ambito,
  metodoIniziale = "",
  onConferma,
  onFatto,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  titolo: string;
  descrizione?: string;
  importo: number;
  ambito: "lavoro" | "personale";
  metodoIniziale?: string;
  onConferma: (valori: PagamentoFormValues) => Promise<ActionResult>;
  onFatto?: () => void;
}) {
  const [valori, setValori] = useState<PagamentoFormValues>({
    data: todayISO(),
    importo: String(importo).replace(".", ","),
    metodo_pagamento_id: metodoIniziale,
  });
  const [errori, setErrori] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();
  const opzioni = useOpzioniBudget(open);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await onConferma(valori);
      if (!result.ok) {
        setErrori(result.fieldErrors ?? {});
        toast.error(result.error);
        return;
      }
      toast.success("Pagamento registrato");
      onOpenChange(false);
      onFatto?.();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{titolo}</DialogTitle>
          {descrizione && <DialogDescription>{descrizione}</DialogDescription>}
        </DialogHeader>
        <form onSubmit={submit} noValidate>
          <FieldGroup className="gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field data-invalid={Boolean(errori.importo) || undefined}>
                <FieldLabel htmlFor="pagamento-importo">Importo pagato (€)</FieldLabel>
                <Input
                  id="pagamento-importo"
                  value={valori.importo}
                  onChange={(e) => setValori((v) => ({ ...v, importo: e.target.value }))}
                  inputMode="decimal"
                  autoFocus
                />
                <FieldError>{errori.importo}</FieldError>
              </Field>
              <Field data-invalid={Boolean(errori.data) || undefined}>
                <FieldLabel>Data</FieldLabel>
                <DatePicker value={valori.data} onChange={(data) => setValori((v) => ({ ...v, data }))} />
                <FieldError>{errori.data}</FieldError>
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="pagamento-metodo">Pagato con</FieldLabel>
              <MetodoSelect
                id="pagamento-metodo"
                metodi={opzioni.data?.metodi ?? []}
                ambito={ambito}
                value={valori.metodo_pagamento_id}
                onChange={(metodo_pagamento_id) => setValori((v) => ({ ...v, metodo_pagamento_id }))}
              />
            </Field>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
                Annulla
              </Button>
              <Button type="submit" disabled={pending}>
                {pending && <Loader2 className="animate-spin" />}
                Segna pagato
              </Button>
            </div>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}
