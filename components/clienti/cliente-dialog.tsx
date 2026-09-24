"use client";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { clienteVuoto, type ClienteFormValues } from "@/lib/schemas/clienti";

import { ClienteForm } from "./cliente-form";

export function ClienteDialog({
  open,
  onOpenChange,
  clienteId,
  defaultValues = clienteVuoto,
  tagSuggestions,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clienteId?: string;
  defaultValues?: ClienteFormValues;
  tagSuggestions: string[];
  onSaved: (id: string) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{clienteId ? "Modifica cliente" : "Nuovo cliente"}</DialogTitle>
          {!clienteId && (
            <DialogDescription>Parti dalla partita IVA: se VIES la trova, compila il resto.</DialogDescription>
          )}
        </DialogHeader>
        {open && (
          <ClienteForm
            clienteId={clienteId}
            defaultValues={defaultValues}
            tagSuggestions={tagSuggestions}
            onSaved={(id) => {
              onOpenChange(false);
              onSaved(id);
            }}
            onCancel={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
