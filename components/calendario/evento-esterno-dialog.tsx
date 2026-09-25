"use client";

import { CalendarDays, Clock, MapPin } from "lucide-react";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { RigaCalendario } from "@/lib/calendario";
import { addDays } from "@/lib/dates/giorni";
import { capitalize, formatLongDate, formatTime, localDateTime } from "@/lib/dates/format";

function periodo(r: RigaCalendario): string {
  const giorno = capitalize(formatLongDate(localDateTime(r.inizio).slice(0, 10)));
  if (r.tutto_il_giorno) {
    // La fine dei "tutto il giorno" è esclusiva: l'ultimo giorno è quello prima.
    const ultimo = r.fine ? addDays(localDateTime(r.fine).slice(0, 10), -1) : null;
    if (ultimo && ultimo > localDateTime(r.inizio).slice(0, 10)) {
      return `${giorno} → ${capitalize(formatLongDate(ultimo))}`;
    }
    return `${giorno} · tutto il giorno`;
  }
  const inizio = formatTime(r.inizio);
  return r.fine ? `${giorno} · ${inizio}–${formatTime(r.fine)}` : `${giorno} · ${inizio}`;
}

/** Dettagli in sola lettura di un evento di un calendario esterno. */
export function EventoEsternoDialog({ evento, onClose }: { evento: RigaCalendario | null; onClose: () => void }) {
  return (
    <Dialog open={evento !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        {evento && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-start gap-2">
                <span
                  className="mt-1.5 size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: evento.colore_sfondo ?? "var(--muted-foreground)" }}
                />
                <span className="min-w-0">{evento.titolo}</span>
              </DialogTitle>
              {evento.origine && (
                <DialogDescription>
                  Dal calendario «{evento.origine}», in sola lettura: si modifica da lì.
                </DialogDescription>
              )}
            </DialogHeader>
            <div className="space-y-2 text-sm">
              <p className="flex items-center gap-2">
                {evento.tutto_il_giorno ? <CalendarDays className="size-4 text-muted-foreground" /> : <Clock className="size-4 text-muted-foreground" />}
                {periodo(evento)}
              </p>
              {evento.luogo && (
                <p className="flex items-center gap-2">
                  <MapPin className="size-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0">{evento.luogo}</span>
                </p>
              )}
              {evento.note && <p className="whitespace-pre-line text-muted-foreground">{evento.note}</p>}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
