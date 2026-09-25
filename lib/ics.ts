// Lettura dei feed ICS dei calendari esterni (es. iCloud pubblico), in sola
// lettura. Le ricorrenze si espandono qui, alla sincronizzazione, con EXDATE
// e occorrenze spostate (RECURRENCE-ID): nel database finiscono occorrenze
// concrete, senza regole da interpretare al volo.
//
// Le date "locali" (con TZID o fluttuanti) si convertono in UTC con Intl,
// senza librerie di fuso orario aggiuntive.

import { RRule } from "rrule";

export type EventoIcs = {
  /** Chiave unica nell'ambito del calendario (UID, più l'inizio per le occorrenze). */
  uid: string;
  titolo: string;
  /** Istante ISO in UTC. */
  inizio: string;
  fine: string | null;
  tutto_il_giorno: boolean;
  luogo: string | null;
  note: string | null;
};

const FUSO_DEFAULT = "Europe/Rome";
const MAX_OCCORRENZE = 2000;

// ---------------------------------------------------------------------------
// Conversione "ora locale in un fuso IANA" → UTC.
// ---------------------------------------------------------------------------

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string): Intl.DateTimeFormat {
  let f = formatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
    formatters.set(timeZone, f);
  }
  return f;
}

/** Com'è letto l'istante `utc` nel fuso, come millisecondi "di parete". */
function wallInZone(utc: number, timeZone: string): number {
  const parti = formatter(timeZone).formatToParts(new Date(utc));
  const v: Record<string, number> = {};
  for (const p of parti) if (p.type !== "literal") v[p.type] = Number(p.value);
  // "24" a mezzanotte con hourCycle h24 di alcuni ambienti.
  const ora = v.hour === 24 ? 0 : v.hour;
  return Date.UTC(v.year, v.month - 1, v.day, ora, v.minute, v.second);
}

/**
 * L'istante UTC che nel fuso indicato si legge come l'ora "di parete" data
 * (millisecondi di un Date fluttuante). Due iterazioni per i salti di ora legale.
 */
export function zonedToUtc(wallMs: number, timeZone: string): Date {
  if (timeZone === "UTC") return new Date(wallMs);
  let guess = wallMs;
  for (let i = 0; i < 2; i++) {
    guess = guess - (wallInZone(guess, timeZone) - wallMs);
  }
  return new Date(guess);
}

// ---------------------------------------------------------------------------
// Lettura del testo ICS.
// ---------------------------------------------------------------------------

type Proprieta = { nome: string; params: Record<string, string>; valore: string };

/** Righe "unfolded": una continuazione inizia con spazio o tab (RFC 5545). */
export function righeIcs(testo: string): string[] {
  const grezze = testo.split(/\r?\n/);
  const righe: string[] = [];
  for (const r of grezze) {
    if ((r.startsWith(" ") || r.startsWith("\t")) && righe.length > 0) {
      righe[righe.length - 1] += r.slice(1);
    } else if (r.length > 0) {
      righe.push(r);
    }
  }
  return righe;
}

function parseProprieta(riga: string): Proprieta | null {
  // Il valore inizia al primo ":" fuori dalle virgolette dei parametri.
  let inQuote = false;
  for (let i = 0; i < riga.length; i++) {
    const c = riga[i];
    if (c === '"') inQuote = !inQuote;
    else if (c === ":" && !inQuote) {
      const sinistra = riga.slice(0, i);
      const valore = riga.slice(i + 1);
      const [nome, ...coppie] = sinistra.split(";");
      const params: Record<string, string> = {};
      for (const coppia of coppie) {
        const uguale = coppia.indexOf("=");
        if (uguale > 0) {
          params[coppia.slice(0, uguale).toUpperCase()] = coppia.slice(uguale + 1).replace(/^"|"$/g, "");
        }
      }
      return { nome: nome.toUpperCase(), params, valore };
    }
  }
  return null;
}

function unescapeIcs(valore: string): string {
  return valore.replace(/\\n/gi, "\n").replace(/\\([,;\\])/g, "$1");
}

// ---------------------------------------------------------------------------
// Date ICS. Un valore è una data (giornata intera), un istante UTC (…Z) o
// un'ora locale (con TZID oppure fluttuante).
// ---------------------------------------------------------------------------

type DataIcs = {
  /** Millisecondi "di parete" (per giornate intere: mezzanotte). */
  wall: number;
  soloData: boolean;
  /** Fuso in cui leggere `wall`; "UTC" per i valori con la Z. */
  fuso: string;
};

function parseDataIcs(p: Proprieta, valore: string): DataIcs | null {
  const soloData = p.params.VALUE === "DATE" || /^\d{8}$/.test(valore);
  const m = valore.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/);
  if (!m) return null;
  const [, y, mo, d, hh = "0", mm = "0", ss = "0", zulu] = m;
  const wall = Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(hh), Number(mm), Number(ss));
  const fuso = soloData ? FUSO_DEFAULT : zulu ? "UTC" : (p.params.TZID ?? FUSO_DEFAULT);
  return { wall, soloData, fuso };
}

// ---------------------------------------------------------------------------
// VEVENT.
// ---------------------------------------------------------------------------

type VEvent = {
  uid: string;
  titolo: string;
  inizio: DataIcs;
  fine: DataIcs | null;
  rrule: string | null;
  exdate: number[];
  recurrenceId: DataIcs | null;
  luogo: string | null;
  note: string | null;
  cancellato: boolean;
};

function parseVEvents(testo: string): VEvent[] {
  const eventi: VEvent[] = [];
  let corrente: Partial<VEvent> & { exdate: number[] } = { exdate: [] };
  let dentro = false;
  for (const riga of righeIcs(testo)) {
    if (riga === "BEGIN:VEVENT") {
      dentro = true;
      corrente = { exdate: [] };
      continue;
    }
    if (riga === "END:VEVENT") {
      dentro = false;
      if (corrente.uid && corrente.inizio) {
        eventi.push({
          uid: corrente.uid,
          titolo: corrente.titolo || "(senza titolo)",
          inizio: corrente.inizio,
          fine: corrente.fine ?? null,
          rrule: corrente.rrule ?? null,
          exdate: corrente.exdate,
          recurrenceId: corrente.recurrenceId ?? null,
          luogo: corrente.luogo ?? null,
          note: corrente.note ?? null,
          cancellato: corrente.cancellato ?? false,
        });
      }
      continue;
    }
    if (!dentro) continue;
    const p = parseProprieta(riga);
    if (!p) continue;
    switch (p.nome) {
      case "UID":
        corrente.uid = p.valore;
        break;
      case "SUMMARY":
        corrente.titolo = unescapeIcs(p.valore);
        break;
      case "LOCATION":
        corrente.luogo = unescapeIcs(p.valore) || null;
        break;
      case "DESCRIPTION":
        corrente.note = unescapeIcs(p.valore) || null;
        break;
      case "DTSTART":
        corrente.inizio = parseDataIcs(p, p.valore) ?? undefined;
        break;
      case "DTEND":
        corrente.fine = parseDataIcs(p, p.valore) ?? undefined;
        break;
      case "RRULE":
        corrente.rrule = p.valore;
        break;
      case "EXDATE":
        for (const v of p.valore.split(",")) {
          const d = parseDataIcs(p, v.trim());
          if (d) corrente.exdate.push(d.wall);
        }
        break;
      case "RECURRENCE-ID":
        corrente.recurrenceId = parseDataIcs(p, p.valore) ?? undefined;
        break;
      case "STATUS":
        corrente.cancellato = p.valore.toUpperCase() === "CANCELLED";
        break;
    }
  }
  return eventi;
}

// ---------------------------------------------------------------------------
// Espansione nell'intervallo richiesto.
// ---------------------------------------------------------------------------

function chiaveOccorrenza(uid: string, wall: number): string {
  return `${uid}:${new Date(wall).toISOString().slice(0, 16)}`;
}

function emetti(e: VEvent, uid: string, inizioWall: number, out: EventoIcs[], dal: Date, al: Date) {
  const inizio = e.inizio.soloData
    ? zonedToUtc(inizioWall, FUSO_DEFAULT)
    : zonedToUtc(inizioWall, e.inizio.fuso);
  // La durata si conserva in "ore di parete" rispetto all'evento originale.
  const durata = e.fine ? e.fine.wall - e.inizio.wall : e.inizio.soloData ? 24 * 60 * 60 * 1000 : null;
  const fine = durata !== null ? new Date(inizio.getTime() + durata) : null;
  const ultimo = fine ?? inizio;
  if (ultimo < dal || inizio > al) return;
  out.push({
    uid,
    titolo: e.titolo,
    inizio: inizio.toISOString(),
    fine: fine ? fine.toISOString() : null,
    tutto_il_giorno: e.inizio.soloData,
    luogo: e.luogo,
    note: e.note,
  });
}

/**
 * Eventi del feed nell'intervallo [dal, al], con le ricorrenze già espanse.
 * Le occorrenze spostate sostituiscono quelle della regola; le cancellate
 * (STATUS:CANCELLED o EXDATE) spariscono.
 */
export function eventiDaIcs(testo: string, dal: Date, al: Date): EventoIcs[] {
  const eventi = parseVEvents(testo);
  const out: EventoIcs[] = [];

  // Occorrenze riscritte, per UID: la regola del padre le salta.
  const spostate = new Map<string, Set<number>>();
  for (const e of eventi) {
    if (!e.recurrenceId) continue;
    const set = spostate.get(e.uid) ?? new Set<number>();
    set.add(e.recurrenceId.wall);
    spostate.set(e.uid, set);
  }

  for (const e of eventi) {
    if (out.length >= MAX_OCCORRENZE) break;
    if (e.recurrenceId) {
      if (!e.cancellato) emetti(e, chiaveOccorrenza(e.uid, e.recurrenceId.wall), e.inizio.wall, out, dal, al);
      continue;
    }
    if (e.cancellato) continue;
    if (!e.rrule) {
      emetti(e, e.uid, e.inizio.wall, out, dal, al);
      continue;
    }
    // Ricorrente: si espande in "ora di parete" (date fluttuanti, come nel
    // resto dell'app), con un giorno di margine per i cambi di fuso.
    let rule: RRule;
    try {
      rule = new RRule({ ...RRule.parseString(e.rrule), dtstart: new Date(e.inizio.wall) });
    } catch {
      continue;
    }
    const margine = 24 * 60 * 60 * 1000;
    const wallDal = new Date(dal.getTime() - margine);
    const wallAl = new Date(al.getTime() + margine);
    const exdate = new Set(e.exdate);
    const salta = spostate.get(e.uid);
    for (const occ of rule.between(wallDal, wallAl, true)) {
      if (out.length >= MAX_OCCORRENZE) break;
      const wall = occ.getTime();
      if (exdate.has(wall) || salta?.has(wall)) continue;
      emetti(e, chiaveOccorrenza(e.uid, wall), wall, out, dal, al);
    }
  }
  return out;
}
