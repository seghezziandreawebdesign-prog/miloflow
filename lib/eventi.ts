import { localDateTime } from "@/lib/dates/format";
import { occorrenzeEvento } from "@/lib/dates/ricorrenza";

type EventoBase = {
  id: string;
  titolo: string;
  inizio: string;
  fine: string | null;
  tutto_il_giorno: boolean;
  ricorrenza: string | null;
};

export type OccorrenzaEvento<T extends EventoBase> = T & {
  /** Ora di inizio locale "HH:mm", null se dura tutto il giorno o è iniziato prima. */
  ora: string | null;
  oraFine: string | null;
};

/**
 * Eventi che cadono in un giorno (ora di Roma): quelli che lo attraversano e
 * le occorrenze degli eventi ricorrenti. Ordinati: prima quelli di tutto il
 * giorno, poi per ora.
 */
export function eventiDelGiorno<T extends EventoBase>(eventi: T[], giorno: string): OccorrenzaEvento<T>[] {
  const out: OccorrenzaEvento<T>[] = [];
  for (const e of eventi) {
    const inizio = localDateTime(e.inizio);
    const fine = e.fine ? localDateTime(e.fine) : inizio;
    if (e.ricorrenza) {
      let occorrenze: string[] = [];
      try {
        occorrenze = occorrenzeEvento(e.ricorrenza, inizio, giorno, giorno);
      } catch {
        // RRULE non valida: l'evento si mostra solo nel suo giorno.
        occorrenze = inizio.slice(0, 10) === giorno ? [inizio] : [];
      }
      for (const o of occorrenze) {
        out.push({ ...e, ora: e.tutto_il_giorno ? null : o.slice(11, 16), oraFine: e.tutto_il_giorno || !e.fine ? null : fine.slice(11, 16) });
      }
      continue;
    }
    const dal = inizio.slice(0, 10);
    const al = fine.slice(0, 10);
    if (dal > giorno || al < giorno) continue;
    const iniziaOggi = dal === giorno;
    out.push({
      ...e,
      ora: e.tutto_il_giorno || !iniziaOggi ? null : inizio.slice(11, 16),
      oraFine: e.tutto_il_giorno || !e.fine || al !== giorno ? null : fine.slice(11, 16),
    });
  }
  return out.sort((a, b) => (a.ora ?? "").localeCompare(b.ora ?? ""));
}
