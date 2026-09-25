"use client";

import { Loader2 } from "lucide-react";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { ContrattoFormValues } from "@/lib/schemas/contratti";

import { ContrattoForm } from "./contratto-form";
import { useOpzioniContratto } from "./use-opzioni-contratto";

export function ContrattoDialog({
  open,
  onOpenChange,
  contrattoId,
  defaultValues,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contrattoId?: string;
  defaultValues: ContrattoFormValues;
  onSaved: (id: string) => void;
}) {
  const { data: opzioni } = useOpzioniContratto(open);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{contrattoId ? "Modifica contratto" : "Nuovo contratto"}</DialogTitle>
        </DialogHeader>
        {open &&
          (opzioni ? (
            <ContrattoForm
              contrattoId={contrattoId}
              defaultValues={defaultValues}
              opzioni={opzioni}
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
