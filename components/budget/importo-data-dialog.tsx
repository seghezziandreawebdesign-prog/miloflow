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

type Valori = { data: string; importo: string; note: string };

/** Importo, data e nota: prelievo da un risparmio o valore di un investimento. */
export function ImportoDataDialog({
  open,
  onOpenChange,
  titolo,
  descrizione,
  etichettaImporto,
  etichettaConferma,
  messaggio,
  importo = null,
  onConferma,
  onFatto,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  titolo: string;
  descrizione?: string;
  etichettaImporto: string;
  etichettaConferma: string;
  messaggio: string;
  importo?: number | null;
  onConferma: (valori: Valori) => Promise<ActionResult>;
  onFatto?: () => void;
}) {
  const [valori, setValori] = useState<Valori>({
    data: todayISO(),
    importo: importo === null ? "" : String(importo).replace(".", ","),
    note: "",
  });
  const [errori, setErrori] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await onConferma(valori);
      if (!result.ok) {
        setErrori(result.fieldErrors ?? {});
        toast.error(result.error);
        return;
      }
      toast.success(messaggio);
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
                <FieldLabel htmlFor="importo-data-importo">{etichettaImporto}</FieldLabel>
                <Input
                  id="importo-data-importo"
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
              <FieldLabel htmlFor="importo-data-note">Nota</FieldLabel>
              <Input id="importo-data-note" value={valori.note} onChange={(e) => setValori((v) => ({ ...v, note: e.target.value }))} />
            </Field>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
                Annulla
              </Button>
              <Button type="submit" disabled={pending}>
                {pending && <Loader2 className="animate-spin" />}
                {etichettaConferma}
              </Button>
            </div>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}
