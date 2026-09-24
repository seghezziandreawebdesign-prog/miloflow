"use client";

import { useCalendarController, type DateSelectInfo, type EventDropInfo, type EventResizeDoneInfo } from "@fullcalendar/react";
import { useQueryClient } from "@tanstack/react-query";
import { CalendarPlus, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { useApriEntita } from "@/components/drawer/use-apri-entita";
import { Segmented } from "@/components/segmented";
import { useAggiornaTask } from "@/components/task/dati";
import { useNuovoEvento } from "@/components/task/nuova-task";
import { Button } from "@/components/ui/button";
import { spostaEvento } from "@/lib/actions/eventi";
import { ambitoDiDefault, type FiltroAmbito } from "@/lib/ambito";
import {
  eventiPerCalendario,
  minutiTra,
  riferimentoEvento,
  VISTE_CALENDARIO,
  vistaDaFullCalendar,
  type VistaCalendario,
} from "@/lib/calendario";
import { addDays } from "@/lib/dates/giorni";
import { taskToDb } from "@/lib/schemas/task";
import { cn } from "@/lib/utils";

import type { PropsEventoFc } from "./calendario-fc";
import { CreaDaSlot, type SlotScelto } from "./crea-da-slot";
import { invalidaCalendario, useCalendario } from "./dati";
import { FiltriCalendario, useFiltriCalendario } from "./filtri-calendario";

// FullCalendar lavora solo nel browser.
const CalendarioFc = dynamic(() => import("./calendario-fc"), {
  ssr: false,
  loading: () => (
    <div className="grid h-full min-h-96 place-items-center text-muted-foreground">
      <Loader2 className="size-5 animate-spin" />
    </div>
  ),
});

export type ImpostazioniCalendario = {
  intervallo_minuti: number;
  ora_inizio: string;
  ora_fine: string;
  vista_default: VistaCalendario;
};

/** Giorno e ora locali (fuso del browser) di una Date. */
function localeDi(d: Date): { data: string; ora: string } {
  const p = (n: number) => String(n).padStart(2, "0");
  return {
    data: `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`,
    ora: `${p(d.getHours())}:${p(d.getMinutes())}`,
  };
}

export function CalendarioView({ filtroAmbito, impostazioni }: { filtroAmbito: FiltroAmbito; impostazioni: ImpostazioniCalendario }) {
  const controller = useCalendarController();
  const apri = useApriEntita();
  const nuovoEvento = useNuovoEvento();
  const queryClient = useQueryClient();
  const aggiornaTask = useAggiornaTask();
  const [attivi, setAttivi] = useFiltriCalendario();
  const [intervallo, setIntervallo] = useState<{ dal: string; al: string } | null>(null);
  const [titolo, setTitolo] = useState("");
  const [slot, setSlot] = useState<SlotScelto | null>(null);
  const { data, isFetching } = useCalendario(intervallo?.dal ?? null, intervallo?.al ?? null, filtroAmbito);

  // Su telefono si parte dal giorno, che è l'unica vista leggibile.
  const [vistaIniziale] = useState(() => {
    const stretto = typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches;
    const scelta = stretto && impostazioni.vista_default !== "lista" ? "giorno" : impostazioni.vista_default;
    return VISTE_CALENDARIO.find((v) => v.value === scelta)?.fc ?? "timeGridWeek";
  });
  const [vista, setVista] = useState<VistaCalendario>(() => vistaDaFullCalendar(vistaIniziale));

  const eventi = useMemo(
    () => (data && intervallo ? eventiPerCalendario(data, attivi, intervallo.dal, intervallo.al) : []),
    [data, attivi, intervallo],
  );

  function cambiaVista(v: VistaCalendario) {
    setVista(v);
    controller.changeView(VISTE_CALENDARIO.find((x) => x.value === v)?.fc ?? "timeGridWeek");
  }

  function onSelect(info: DateSelectInfo) {
    const inizio = localeDi(info.start);
    if (info.allDay) {
      setSlot({ data: inizio.data });
      return;
    }
    const fine = localeDi(info.end);
    setSlot({ data: inizio.data, ora: inizio.ora, oraFine: fine.ora, durataMin: minutiTra(info.start, info.end) });
  }

  async function onEventDrop(info: EventDropInfo | EventResizeDoneInfo) {
    const p = info.event.extendedProps as PropsEventoFc;
    const start = info.event.start;
    const end = info.event.end;
    if (!start) return info.revert();
    if (p.tipo === "task") {
      const { data: giorno, ora } = localeDi(start);
      const patch = info.event.allDay
        ? { data_pianificata: giorno, ora_inizio: "" }
        : { data_pianificata: giorno, ora_inizio: ora, ...(end ? { durata_min: String(minutiTra(start, end)) } : {}) };
      aggiornaTask.mutate(
        { id: p.id, patch, cache: taskToDb(patch) },
        { onError: () => info.revert(), onSuccess: () => toast.success(info.event.allDay ? `Spostata al ${giorno.split("-").reverse().join("/")}` : `Spostata alle ${ora}`) },
      );
      return;
    }
    if (p.tipo === "evento") {
      const result = await spostaEvento(p.id, {
        inizio: start.toISOString(),
        fine: end ? end.toISOString() : null,
        tutto_il_giorno: info.event.allDay,
      });
      if (!result.ok) {
        toast.error(result.error);
        info.revert();
        return;
      }
      invalidaCalendario(queryClient);
      void queryClient.invalidateQueries({ queryKey: ["evento", p.id] });
      toast.success("Evento spostato");
      return;
    }
    info.revert();
  }

  return (
    <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[13.5rem_minmax(0,1fr)] lg:gap-6">
      <aside className="hidden lg:block">
        <FiltriCalendario attivi={attivi} onChange={setAttivi} />
      </aside>

      <div className="flex min-w-0 flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" aria-label="Precedente" onClick={() => controller.prev()}>
              <ChevronLeft />
            </Button>
            <Button variant="outline" size="icon" aria-label="Successivo" onClick={() => controller.next()}>
              <ChevronRight />
            </Button>
            <Button variant="outline" onClick={() => controller.today()}>
              Oggi
            </Button>
          </div>
          <h2 className="min-w-0 flex-1 truncate text-[17px] font-semibold tracking-tight first-letter:uppercase sm:text-lg">
            {titolo}
            {isFetching && <Loader2 className="ml-2 inline size-3.5 animate-spin text-muted-foreground" />}
          </h2>
          <Segmented label="Vista" value={vista} onChange={cambiaVista} opzioni={VISTE_CALENDARIO} className="[&>p]:sr-only" />
          <Button className="hidden sm:inline-flex" onClick={() => nuovoEvento({ ambito: ambitoDiDefault(filtroAmbito) })}>
            <CalendarPlus />
            Nuovo evento
          </Button>
        </div>

        <div className="lg:hidden">
          <FiltriCalendario attivi={attivi} onChange={setAttivi} compatto />
        </div>

        <div
          className={cn(
            "calendario-milo min-h-[28rem] overflow-hidden rounded-xl bg-card ring-1 ring-black/8",
            "h-[calc(100svh-15rem)] lg:h-[calc(100svh-10.5rem)]",
          )}
        >
          <CalendarioFc
            controller={controller}
            eventi={eventi}
            vistaIniziale={vistaIniziale}
            intervalloMinuti={impostazioni.intervallo_minuti}
            oraInizio={impostazioni.ora_inizio}
            oraFine={impostazioni.ora_fine}
            onDatesSet={(info) => {
              const dal = localeDi(info.start).data;
              // end è esclusivo: l'ultimo giorno visibile è quello prima.
              const al = addDays(localeDi(info.end).data, -1);
              setIntervallo((i) => (i && i.dal === dal && i.al === al ? i : { dal, al }));
              setTitolo(info.titolo);
              setVista(vistaDaFullCalendar(info.vista));
            }}
            onEventClick={(p) => apri(riferimentoEvento(p))}
            onSelect={onSelect}
            onEventDrop={onEventDrop}
            onEventResize={onEventDrop}
          />
        </div>
        <p className="text-xs text-muted-foreground lg:hidden">Tieni premuto su uno spazio vuoto per aggiungere, su un elemento per spostarlo.</p>
      </div>

      <CreaDaSlot slot={slot} ambito={ambitoDiDefault(filtroAmbito)} onClose={() => setSlot(null)} />
    </div>
  );
}
