// Formattazione italiana, sempre nel fuso Europe/Rome (il server gira in UTC).

export const TIME_ZONE = "Europe/Rome";

const dateFormatter = new Intl.DateTimeFormat("it-IT", {
  timeZone: TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const longDateFormatter = new Intl.DateTimeFormat("it-IT", {
  timeZone: TIME_ZONE,
  weekday: "long",
  day: "numeric",
  month: "long",
});

const currencyFormatter = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" });

// Le colonne `date` di Postgres arrivano come "yyyy-MM-dd": vanno lette come
// giorno di calendario, non come istante UTC, altrimenti slittano di un giorno.
function toDate(value: Date | string): Date {
  if (typeof value !== "string") return value;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (match) {
    return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12));
  }
  return new Date(value);
}

/** dd/MM/yyyy */
export function formatDate(value: Date | string): string {
  return dateFormatter.format(toDate(value));
}

/** es. "giovedì 24 settembre" */
export function formatLongDate(value: Date | string): string {
  return longDateFormatter.format(toDate(value));
}

/** Prima lettera maiuscola, il resto invariato (in italiano i mesi restano minuscoli). */
export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function formatCurrency(value: number): string {
  return currencyFormatter.format(value);
}

/** Data odierna in Europe/Rome come "yyyy-MM-dd". */
export function todayISO(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(now);
}

const localPartsFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** Istante (timestamptz) → ora locale di Europe/Rome come "yyyy-MM-ddTHH:mm". */
export function localDateTime(value: Date | string): string {
  const parts = Object.fromEntries(
    localPartsFormatter.formatToParts(typeof value === "string" ? new Date(value) : value).map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

const weekdayFormatter = new Intl.DateTimeFormat("it-IT", { timeZone: "UTC", weekday: "long" });
const dayMonthFormatter = new Intl.DateTimeFormat("it-IT", { timeZone: "UTC", day: "numeric", month: "short" });

/**
 * Giorno rispetto a oggi: "Oggi", "Domani", "Ieri", il nome del giorno entro
 * la settimana, altrimenti "12 ott" (con l'anno se diverso da quello corrente).
 */
export function formatGiornoRelativo(iso: string, oggi: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const [oy, om, od] = oggi.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d, 12));
  const diff = Math.round((date.getTime() - Date.UTC(oy, om - 1, od, 12)) / 86_400_000);
  if (diff === 0) return "Oggi";
  if (diff === 1) return "Domani";
  if (diff === -1) return "Ieri";
  if (diff > 1 && diff < 7) return capitalize(weekdayFormatter.format(date));
  const base = dayMonthFormatter.format(date).replace(".", "");
  return y === oy ? base : `${base} ${y}`;
}
