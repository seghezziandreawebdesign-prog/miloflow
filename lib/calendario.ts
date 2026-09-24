// Calendario: tipi di elemento, colori e conversione delle righe di
// v_calendario negli eventi di FullCalendar. Funzioni pure, con test.

import { addDays } from "@/lib/dates/giorni";
import { fromLocalDateTime, localDateTime } from "@/lib/dates/format";
import { occorrenzeEvento } from "@/lib/dates/ricorrenza";
import type { TipoEntita } from "@/lib/entita";

export const TIPI_CALENDARIO = [
  { value: "task", label: "Task", descrizione: "Con data di inizio" },
  { value: "deadline", label: "Scadenze task", descrizione: "Entro quando" },
  { value: "scadenza_servizio", label: "Scadenze servizi", descrizione: "Rinnovi in arrivo" },
  { value: "evento", label: "Eventi", descrizione: "Appuntamenti e call" },
  { value: "rata", label: "Rate", descrizione: "Debiti da pagare" },
  { value: "movimento", label: "Spese previste", descrizione: "Dal budget" },
] as const;
export type TipoCalendario = (typeof TIPI_CALENDARIO)[number]["value"];
export const TUTTI_I_TIPI: TipoCalendario[] = TIPI_CALENDARIO.map((t) => t.value);

export type Ambito = "lavoro" | "personale";

export type RigaCalendario = {
  id: string;
  tipo: TipoCalendario;
  titolo: string;
  /** Istante ISO. */
  inizio: string;
  fine: string | null;
  tutto_il_giorno: boolean;
  ambito: Ambito;
  cliente_id: string | null;
  progetto_id: string | null;
  colore: string | null;
  modificabile: boolean;
  ricorrenza: string | null;
  /** Colore scelto per l'evento: riempie lo sfondo. */
  colore_sfondo: string | null;
};

export type EventoCalendario = {
  id: string;
  title: string;
  start: string;
  end?: string;
  allDay: boolean;
  editable: boolean;
  durationEditable: boolean;
  backgroundColor: string;
  borderColor: string;
  textColor: string;
  /** FullCalendar 7 legge questi due: tinta dell'evento e colore del testo. */
  color: string;
  contrastColor: string;
  classNames: string[];
  extendedProps: { tipo: TipoCalendario; id: string; ambito: Ambito; ricorrente: boolean };
};

// Colori: dipendono dall'ambito, con una variazione per tipo.
const AMBITI = {
  lavoro: { forte: "#3a7bd5", soft: "#e6eefb" },
  personale: { forte: "#9b59d0", soft: "#f1e8fa" },
};
const TIPI_COLORE: Record<Exclude<TipoCalendario, "task" | "evento">, { forte: string; soft: string }> = {
  deadline: { forte: "#ff3b30", soft: "#fdecea" },
  scadenza_servizio: { forte: "#e08a00", soft: "#fff4e0" },
  rata: { forte: "#1f8a3b", soft: "#e3f7e8" },
  movimento: { forte: "#6e6e73", soft: "#f0f0f3" },
};

export function coloriEvento(tipo: TipoCalendario, ambito: Ambito, coloreProgetto: string | null, coloreSfondo: string | null = null) {
  const a = AMBITI[ambito];
  switch (tipo) {
    case "evento": {
      const sfondo = coloreSfondo ?? a.forte;
      return { backgroundColor: sfondo, borderColor: coloreProgetto ?? sfondo, textColor: "#ffffff", color: sfondo, contrastColor: "#ffffff" };
    }
    case "task":
      return { backgroundColor: a.soft, borderColor: coloreProgetto ?? a.forte, textColor: a.forte, color: a.forte, contrastColor: "#ffffff" };
    default: {
      const c = TIPI_COLORE[tipo];
      return { backgroundColor: c.soft, borderColor: coloreProgetto ?? c.forte, textColor: c.forte, color: c.forte, contrastColor: "#ffffff" };
    }
  }
}

/** Da un evento del calendario al riferimento per il pannello. */
export function riferimentoEvento(p: { tipo: TipoCalendario; id: string }): { tipo: TipoEntita; id: string } {
  switch (p.tipo) {
    case "task":
    case "deadline":
      return { tipo: "task", id: p.id };
    case "scadenza_servizio":
      return { tipo: "servizio", id: p.id };
    case "evento":
      return { tipo: "evento", id: p.id };
    case "rata":
      return { tipo: "debito", id: p.id };
    case "movimento":
      return { tipo: "movimento", id: p.id };
  }
}

function giornoLocale(istante: string): string {
  return localDateTime(istante).slice(0, 10);
}

/**
 * Righe di v_calendario → eventi di FullCalendar per l'intervallo visibile
 * [dal, al] (giorni inclusi). Le ricorrenze degli eventi si espandono qui;
 * le occorrenze non si trascinano (si sposterebbe tutta la serie).
 */
export function eventiPerCalendario(
  righe: RigaCalendario[],
  attivi: ReadonlySet<TipoCalendario>,
  dal: string,
  al: string,
): EventoCalendario[] {
  const out: EventoCalendario[] = [];
  for (const r of righe) {
    if (!attivi.has(r.tipo)) continue;
    const colori = coloriEvento(r.tipo, r.ambito, r.colore, r.colore_sfondo);
    const base = {
      title: r.tipo === "deadline" ? `Entro: ${r.titolo}` : r.titolo,
      allDay: r.tutto_il_giorno,
      ...colori,
      classNames: [`fc-milo`, `fc-tipo-${r.tipo}`, `fc-ambito-${r.ambito}`],
    };

    if (r.tipo === "evento" && r.ricorrenza) {
      const inizioLocale = localDateTime(r.inizio);
      const durata = r.fine ? new Date(r.fine).getTime() - new Date(r.inizio).getTime() : 0;
      let occorrenze: string[] = [];
      try {
        occorrenze = occorrenzeEvento(r.ricorrenza, inizioLocale, addDays(dal, -1), addDays(al, 1));
      } catch {
        occorrenze = [inizioLocale];
      }
      for (const o of occorrenze) {
        const start = fromLocalDateTime(o);
        const end = durata > 0 ? new Date(start.getTime() + durata) : null;
        out.push({
          ...base,
          id: `${r.tipo}:${r.id}:${o.slice(0, 10)}`,
          start: r.tutto_il_giorno ? o.slice(0, 10) : start.toISOString(),
          ...(end ? { end: r.tutto_il_giorno ? giornoLocale(end.toISOString()) : end.toISOString() } : {}),
          editable: false,
          durationEditable: false,
          extendedProps: { tipo: r.tipo, id: r.id, ambito: r.ambito, ricorrente: true },
        });
      }
      continue;
    }

    out.push({
      ...base,
      id: `${r.tipo}:${r.id}`,
      start: r.tutto_il_giorno ? giornoLocale(r.inizio) : r.inizio,
      ...(r.fine ? { end: r.tutto_il_giorno ? giornoLocale(r.fine) : r.fine } : {}),
      editable: r.modificabile,
      // Le task con orario si allungano cambiando la durata; a giornata intera no.
      durationEditable: r.modificabile && !r.tutto_il_giorno,
      extendedProps: { tipo: r.tipo, id: r.id, ambito: r.ambito, ricorrente: false },
    });
  }
  return out;
}

/** Minuti tra due istanti, arrotondati. */
export function minutiTra(inizio: Date, fine: Date): number {
  return Math.max(1, Math.round((fine.getTime() - inizio.getTime()) / 60_000));
}

/** Etichette delle viste del calendario e i nomi corrispondenti di FullCalendar. */
export const VISTE_CALENDARIO = [
  { value: "giorno", label: "Giorno", fc: "timeGridDay" },
  { value: "settimana", label: "Settimana", fc: "timeGridWeek" },
  { value: "mese", label: "Mese", fc: "dayGridMonth" },
  { value: "lista", label: "Lista", fc: "listWeek" },
] as const;
export type VistaCalendario = (typeof VISTE_CALENDARIO)[number]["value"];

export function vistaDaFullCalendar(tipo: string): VistaCalendario {
  return VISTE_CALENDARIO.find((v) => v.fc === tipo)?.value ?? "settimana";
}
