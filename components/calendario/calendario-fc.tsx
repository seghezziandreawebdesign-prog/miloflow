"use client";

import FullCalendar, { type CalendarController, type DateSelectInfo, type EventDropInfo, type EventResizeDoneInfo } from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/react/daygrid";
import interactionPlugin from "@fullcalendar/react/interaction";
import listPlugin from "@fullcalendar/react/list";
import itLocale from "@fullcalendar/react/locales/it";
import classicTheme from "@fullcalendar/react/themes/classic";
import timeGridPlugin from "@fullcalendar/react/timegrid";

import "@fullcalendar/react/skeleton.css";
import "@fullcalendar/react/themes/classic/theme.css";
import "@fullcalendar/react/themes/classic/palette.css";

import type { EventoCalendario, TipoCalendario } from "@/lib/calendario";

export type PropsEventoFc = { tipo: TipoCalendario; id: string; ambito: "lavoro" | "personale"; ricorrente: boolean };

/**
 * Il calendario vero e proprio, caricato solo nel browser. La barra in alto
 * è nostra: il componente riceve il controller per prev/next/oggi/vista.
 */
export default function CalendarioFc({
  controller,
  eventi,
  vistaIniziale,
  intervalloMinuti,
  oraInizio,
  oraFine,
  onDatesSet,
  onEventClick,
  onSelect,
  onEventDrop,
  onEventResize,
}: {
  controller: CalendarController;
  eventi: EventoCalendario[];
  vistaIniziale: string;
  intervalloMinuti: number;
  oraInizio: string;
  oraFine: string;
  onDatesSet: (info: { start: Date; end: Date; titolo: string; vista: string }) => void;
  onEventClick: (props: PropsEventoFc) => void;
  onSelect: (info: DateSelectInfo) => void;
  onEventDrop: (info: EventDropInfo) => void;
  onEventResize: (info: EventResizeDoneInfo) => void;
}) {
  const oraCorta = { hour: "2-digit", minute: "2-digit", hour12: false } as const;
  return (
    <FullCalendar
      plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin, classicTheme]}
      controller={controller}
      locale={itLocale}
      timeZone="local"
      initialView={vistaIniziale}
      headerToolbar={false}
      firstDay={1}
      nowIndicator
      editable
      selectable
      selectMirror
      unselectAuto
      dayMaxEvents={4}
      slotDuration={`00:${String(intervalloMinuti).padStart(2, "0")}:00`}
      snapDuration={`00:${String(intervalloMinuti).padStart(2, "0")}:00`}
      slotMinTime={`${oraInizio}:00`}
      slotMaxTime={`${oraFine}:00`}
      scrollTime="08:00:00"
      expandRows
      height="100%"
      events={eventi}
      eventTimeFormat={oraCorta}
      slotHeaderFormat={oraCorta}
      longPressDelay={300}
      selectLongPressDelay={400}
      datesSet={(info) => onDatesSet({ start: info.start, end: info.end, titolo: info.view.title, vista: info.view.type })}
      eventClick={(info) => {
        info.jsEvent.preventDefault();
        onEventClick(info.event.extendedProps as PropsEventoFc);
      }}
      select={onSelect}
      eventDrop={onEventDrop}
      eventResize={onEventResize}
      views={{
        listWeek: { listDayFormat: { weekday: "long", day: "numeric", month: "long" } },
        timeGridWeek: { dayHeaderFormat: { weekday: "short", day: "numeric" } },
        timeGridDay: { dayHeaderFormat: { weekday: "long", day: "numeric", month: "long" } },
      }}
    />
  );
}
