"use client";

import { Loader2 } from "lucide-react";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { ServizioFormValues } from "@/lib/schemas/servizi";

import { ServizioForm } from "./servizio-form";
import { useOpzioniServizio } from "./use-opzioni-servizio";

export function ServizioDialog({
  open,
  onOpenChange,
  servizioId,
  defaultValues,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  servizioId?: string;
  defaultValues: ServizioFormValues;
  onSaved: (id: string) => void;
}) {
  const { data: opzioni } = useOpzioniServizio(open);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Come il pannello della task: finestra larga, il form si apre su due colonne. */}
      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-2xl lg:max-w-[min(1000px,95vw)]">
        <DialogHeader>
          <DialogTitle>{servizioId ? "Modifica servizio" : "Nuovo servizio"}</DialogTitle>
        </DialogHeader>
        {open &&
          (opzioni ? (
            <ServizioForm
              servizioId={servizioId}
              defaultValues={defaultValues}
              opzioni={opzioni}
              mostraEconomico={opzioni.puoBudget}
              onSaved={(id) => {
                onOpenChange(false);
                onSaved(id);
              }}
              onCancel={() => onOpenChange(false)}
            />
          ) : (
            <div className="grid h-40 place-items-center text-muted-foreground">
              <Loader2 className="animate-spin" />
            </div>
          ))}
      </DialogContent>
    </Dialog>
  );
}
