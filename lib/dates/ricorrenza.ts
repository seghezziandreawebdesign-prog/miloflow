// Ricorrenze salvate come stringa RRULE (senza DTSTART: l'inizio è la data
// della task o dell'evento). Qui la conversione da e verso una forma
// comoda per il form, la descrizione in italiano e il calcolo delle occorrenze.
//
// rrule lavora con date "fluttuanti": i Date in UTC rappresentano l'ora locale
// di Europe/Rome, senza conversioni di fuso.

import { Frequency, RRule, Weekday } from "rrule";

import { addDays, diffDays, isoToUtc, utcToIso, weekdayIndex } from "./giorni";

export type FrequenzaRicorrenza = "giornaliera" | "settimanale" | "mensile" | "annuale";

export type Ricorrenza = {
  frequenza: FrequenzaRicorrenza;
  /** Ogni quanti giorni/settimane/mesi/anni. */
  intervallo: number;
  /** Solo per le settimanali: giorni con lunedì = 0 … domenica = 6. Vuoto = il giorno della data. */
  giorni: number[];
};

const FREQ: Record<FrequenzaRicorrenza, Frequency> = {
  giornaliera: RRule.DAILY,
  settimanale: RRule.WEEKLY,
  mensile: RRule.MONTHLY,
  annuale: RRule.YEARLY,
};

const WEEKDAYS = [RRule.MO, RRule.TU, RRule.WE, RRule.TH, RRule.FR, RRule.SA, RRule.SU];

const NOMI_GIORNI = ["lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato", "domenica"];
export const GIORNI_BREVI = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];

export function toRRule(r: Ricorrenza): string {
  const intervallo = Math.max(1, Math.floor(r.intervallo));
  const rule = new RRule({
    freq: FREQ[r.frequenza],
    // Con intervallo 1 si omette, per avere stringhe più corte e confrontabili.
    ...(intervallo > 1 ? { interval: intervallo } : {}),
    byweekday: r.frequenza === "settimanale" && r.giorni.length > 0
      ? [...new Set(r.giorni)].sort().map((g) => WEEKDAYS[g])
      : null,
  });
  return rule.toString().replace(/^RRULE:/, "");
}

/** null se la stringa non è una RRULE che il form sa rappresentare. */
export function fromRRule(value: string | null | undefined): Ricorrenza | null {
  if (!value) return null;
  let options;
  try {
    options = RRule.parseString(value.replace(/^RRULE:/, ""));
  } catch {
    return null;
  }
  const frequenza = (Object.keys(FREQ) as FrequenzaRicorrenza[]).find((k) => FREQ[k] === options.freq);
  if (!frequenza) return null;
  const byweekday = options.byweekday;
  const lista = byweekday == null ? [] : Array.isArray(byweekday) ? byweekday : [byweekday];
  const giorni = lista.map((d) => (d instanceof Weekday ? d.weekday : typeof d === "number" ? d : -1));
  if (giorni.some((g) => g < 0 || g > 6)) return null;
  return { frequenza, intervallo: options.interval ?? 1, giorni: frequenza === "settimanale" ? giorni.sort() : [] };
}

export function isRRuleValida(value: string): boolean {
  return fromRRule(value) !== null;
}

/** "Ogni giorno", "Ogni 2 settimane il lunedì e il giovedì", "Giorni feriali"… */
export function descriviRicorrenza(value: string | null | undefined): string | null {
  const r = fromRRule(value);
  if (!r) return null;
  const n = r.intervallo;
  switch (r.frequenza) {
    case "giornaliera":
      return n === 1 ? "Ogni giorno" : `Ogni ${n} giorni`;
    case "settimanale": {
      if (n === 1 && r.giorni.join() === "0,1,2,3,4") return "Giorni feriali";
      const base = n === 1 ? "Ogni settimana" : `Ogni ${n} settimane`;
      if (r.giorni.length === 0) return base;
      const nomi = r.giorni.map((g) => NOMI_GIORNI[g]);
      const elenco = nomi.length === 1 ? nomi[0] : `${nomi.slice(0, -1).join(", ")} e ${nomi.at(-1)}`;
      return `${base}: ${elenco}`;
    }
    case "mensile":
      return n === 1 ? "Ogni mese" : `Ogni ${n} mesi`;
    case "annuale":
      return n === 1 ? "Ogni anno" : `Ogni ${n} anni`;
  }
}

/** Preset proposti nel form, calcolati sulla data della task. */
export function presetRicorrenza(dataIso: string): { label: string; value: string }[] {
  const g = weekdayIndex(dataIso);
  return [
    { label: "Ogni giorno", value: toRRule({ frequenza: "giornaliera", intervallo: 1, giorni: [] }) },
    { label: "Giorni feriali", value: toRRule({ frequenza: "settimanale", intervallo: 1, giorni: [0, 1, 2, 3, 4] }) },
    { label: `Ogni settimana (${NOMI_GIORNI[g]})`, value: toRRule({ frequenza: "settimanale", intervallo: 1, giorni: [g] }) },
    { label: `Ogni mese (giorno ${Number(dataIso.slice(8))})`, value: toRRule({ frequenza: "mensile", intervallo: 1, giorni: [] }) },
    { label: "Ogni anno", value: toRRule({ frequenza: "annuale", intervallo: 1, giorni: [] }) },
  ];
}

function regola(value: string, inizioIso: string): RRule {
  const options = RRule.parseString(value.replace(/^RRULE:/, ""));
  const start = isoToUtc(inizioIso);
  start.setUTCHours(0, 0, 0, 0);
  return new RRule({ ...options, dtstart: start });
}

/**
 * Prossima occorrenza di una ricorrenza a calendario fisso: la prima dopo la
 * data prevista `base` e non prima di `oggi` (le occorrenze saltate non si
 * recuperano). null se la regola non ha altre occorrenze.
 */
export function prossimaOccorrenza(value: string, base: string, oggi: string): string | null {
  const rule = regola(value, base);
  const da = base >= oggi ? base : addDays(oggi, -1);
  const from = isoToUtc(da);
  from.setUTCHours(0, 0, 0, 0);
  const next = rule.after(from, false);
  return next ? utcToIso(next) : null;
}

/**
 * Date della prossima occorrenza di una task. La data di riferimento è la
 * pianificata, altrimenti la scadenza; se ci sono entrambe, la scadenza
 * mantiene la stessa distanza dalla pianificata.
 */
export function prossimeDateTask(
  task: { ricorrenza: string | null; data_pianificata: string | null; scadenza: string | null },
  oggi: string,
): { data_pianificata: string | null; scadenza: string | null } | null {
  if (!task.ricorrenza || !isRRuleValida(task.ricorrenza)) return null;
  const base = task.data_pianificata ?? task.scadenza ?? oggi;
  const prossima = prossimaOccorrenza(task.ricorrenza, base, oggi);
  if (!prossima) return null;
  if (task.data_pianificata) {
    return {
      data_pianificata: prossima,
      scadenza: task.scadenza ? addDays(prossima, diffDays(task.scadenza, task.data_pianificata)) : null,
    };
  }
  return { data_pianificata: null, scadenza: prossima };
}

/**
 * Inizi delle occorrenze di un evento ricorrente che cadono tra `dal` e `al`
 * (giorni inclusi), in ora locale "yyyy-MM-ddTHH:mm".
 */
export function occorrenzeEvento(value: string, inizioLocale: string, dal: string, al: string): string[] {
  const [data, ora = "00:00"] = inizioLocale.split("T");
  const [h, m] = ora.split(":").map(Number);
  const options = RRule.parseString(value.replace(/^RRULE:/, ""));
  const start = isoToUtc(data);
  start.setUTCHours(h, m, 0, 0);
  const rule = new RRule({ ...options, dtstart: start });
  const from = isoToUtc(dal);
  from.setUTCHours(0, 0, 0, 0);
  const to = isoToUtc(al);
  to.setUTCHours(23, 59, 59, 999);
  // L'inizio conta sempre come prima occorrenza, come nei calendari (RFC 5545).
  const date = rule.between(from, to, true).map((d) => d.toISOString().slice(0, 16));
  const primo = start.toISOString().slice(0, 16);
  if (start >= from && start <= to && !date.includes(primo)) date.unshift(primo);
  return date;
}
