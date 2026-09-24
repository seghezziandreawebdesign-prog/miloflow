// Aritmetica sui giorni di calendario in formato "yyyy-MM-dd".
// Si lavora in UTC a mezzogiorno: nessun cambio d'ora può spostare il giorno.

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isoToUtc(iso: string): Date {
  const m = ISO_RE.exec(iso);
  if (!m) throw new Error(`Data non valida: ${iso}`);
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12));
}

export function utcToIso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  const d = isoToUtc(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return utcToIso(d);
}

/** Giorni da `from` a `to` (positivo se `to` è dopo). */
export function diffDays(to: string, from: string): number {
  return Math.round((isoToUtc(to).getTime() - isoToUtc(from).getTime()) / 86_400_000);
}

/** Giorno della settimana con lunedì = 0 … domenica = 6. */
export function weekdayIndex(iso: string): number {
  return (isoToUtc(iso).getUTCDay() + 6) % 7;
}

/** Lunedì della settimana che contiene `iso`. */
export function startOfWeek(iso: string): string {
  return addDays(iso, -weekdayIndex(iso));
}

/** Controlla che giorno, mese e anno formino una data esistente. */
export function isoFromParts(year: number, month: number, day: number): string | null {
  const d = new Date(Date.UTC(year, month - 1, day, 12));
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) return null;
  return utcToIso(d);
}

export function isIsoDate(value: string): boolean {
  const m = ISO_RE.exec(value);
  return m !== null && isoFromParts(Number(m[1]), Number(m[2]), Number(m[3])) === value;
}
