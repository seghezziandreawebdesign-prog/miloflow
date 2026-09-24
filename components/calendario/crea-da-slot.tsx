"use client";

import { CalendarPlus, ListPlus, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";

import { useNuovaTask, useNuovoEvento } from "@/components/task/nuova-task";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Ambito } from "@/lib/ambito";
import { capitalize, formatLongDate } from "@/lib/dates/format";

export type SlotScelto = {
  /** Giorno "yyyy-MM-dd". */
  data: string;
  /** "HH:mm", assente se tutto il giorno. */
  ora?: string;
  oraFine?: string;
  durataMin?: number;
};

/** Click su uno spazio vuoto del calendario: cosa creare in quel momento. */
export function CreaDaSlot({
  slot,
  ambito,
  onClose,
}: {
  slot: SlotScelto | null;
  ambito: Ambito;
  onClose: () => void;
}) {
  const nuovaTask = useNuovaTask();
  const nuovoEvento = useNuovoEvento();
  const router = useRouter();
  const quando = slot ? `${capitalize(formatLongDate(slot.data))}${slot.ora ? ` alle ${slot.ora}` : ""}` : "";

  const voci = [
    {
      icona: ListPlus,
      label: "Nuova task",
      descrizione: slot?.ora ? "Con data e ora di inizio." : "Con data di inizio.",
      onClick: () =>
        nuovaTask({
          ambito,
          data_pianificata: slot?.data,
          ora_inizio: slot?.ora ?? "",
          durata_min: slot?.durataMin ? String(slot.durataMin) : "",
        }),
    },
    {
      icona: CalendarPlus,
      label: "Nuovo evento",
      descrizione: slot?.ora ? "Appuntamento o call." : "Evento di tutto il giorno.",
      onClick: () =>
        nuovoEvento({
          ambito,
          data_inizio: slot?.data,
          tutto_il_giorno: !slot?.ora,
          ora_inizio: slot?.ora ?? "",
          ora_fine: slot?.oraFine ?? "",
        }),
    },
    {
      icona: RefreshCw,
      label: "Nuovo servizio",
      descrizione: "Con questa data come prossima scadenza.",
      onClick: () => router.push(`/servizi?nuovo=1&scadenza=${slot?.data ?? ""}`),
    },
  ];

  return (
    <Dialog open={slot !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{quando}</DialogTitle>
          <DialogDescription>Cosa vuoi aggiungere?</DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          {voci.map((v) => (
            <button
              key={v.label}
              type="button"
              onClick={() => {
                onClose();
                v.onClick();
              }}
              className="flex items-center gap-3 rounded-lg bg-muted/60 px-3 py-2.5 text-left hover:bg-muted"
            >
              <v.icona className="size-4 shrink-0 text-primary" />
              <span>
                <span className="block text-sm font-medium">{v.label}</span>
                <span className="block text-xs text-muted-foreground">{v.descrizione}</span>
              </span>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
