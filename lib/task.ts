import { addDays, diffDays } from "@/lib/dates/giorni";
import type { Database } from "@/lib/supabase/database.types";

export type StatoTask = Database["public"]["Enums"]["stato_task"];
export type StatoProgetto = Database["public"]["Enums"]["stato_progetto"];

export const STATI_TASK: { value: StatoTask; label: string; className: string }[] = [
  { value: "da_fare", label: "Da fare", className: "bg-muted text-foreground ring-foreground/10" },
  { value: "in_corso", label: "In corso", className: "bg-sky-50 text-sky-700 ring-sky-600/20" },
  { value: "in_attesa", label: "In attesa", className: "bg-amber-50 text-amber-800 ring-amber-600/20" },
  { value: "fatto", label: "Fatto", className: "bg-emerald-50 text-emerald-700 ring-emerald-600/20" },
];

export function statoTask(value: StatoTask) {
  return STATI_TASK.find((s) => s.value === value) ?? STATI_TASK[0];
}

export const PRIORITA: { value: 1 | 2 | 3; label: string; className: string }[] = [
  { value: 1, label: "Alta", className: "text-red-600" },
  { value: 2, label: "Media", className: "text-amber-600" },
  { value: 3, label: "Bassa", className: "text-sky-600" },
];

export function priorita(value: number | null) {
  return PRIORITA.find((p) => p.value === value) ?? null;
}

export const STATI_PROGETTO: { value: StatoProgetto; label: string; className: string }[] = [
  { value: "attivo", label: "Attivo", className: "bg-emerald-50 text-emerald-700 ring-emerald-600/20" },
  { value: "in_pausa", label: "In pausa", className: "bg-amber-50 text-amber-800 ring-amber-600/20" },
  { value: "completato", label: "Completato", className: "bg-sky-50 text-sky-700 ring-sky-600/20" },
  { value: "archiviato", label: "Archiviato", className: "bg-muted text-muted-foreground ring-foreground/10" },
];

export function statoProgetto(value: StatoProgetto) {
  return STATI_PROGETTO.find((s) => s.value === value) ?? STATI_PROGETTO[0];
}

/** Giorni dopo i quali una task in attesa va sollecitata. */
export const GIORNI_SOLLECITO = 5;

type DateTask = {
  stato: StatoTask;
  data_pianificata: string | null;
  scadenza: string | null;
  in_attesa_dal?: string | null;
};

export function isAperta(t: { stato: StatoTask }): boolean {
  return t.stato !== "fatto";
}

/** Pianificata per un giorno già passato e non completata. */
export function isPianificataInRitardo(t: DateTask, oggi: string): boolean {
  return isAperta(t) && t.data_pianificata !== null && t.data_pianificata < oggi;
}

/** Scadenza superata e non completata. */
export function isScaduta(t: DateTask, oggi: string): boolean {
  return isAperta(t) && t.scadenza !== null && t.scadenza < oggi;
}

export function giorniInAttesa(t: DateTask, oggi: string): number | null {
  return t.stato === "in_attesa" && t.in_attesa_dal ? diffDays(oggi, t.in_attesa_dal) : null;
}

export function daSollecitare(t: DateTask, oggi: string): boolean {
  const giorni = giorniInAttesa(t, oggi);
  return giorni !== null && giorni > GIORNI_SOLLECITO;
}

/** Inbox: senza data pianificata, senza scadenza e senza progetto. */
export function isInbox(t: DateTask & { progetto_id: string | null; parent_id: string | null }): boolean {
  return isAperta(t) && t.parent_id === null && !t.data_pianificata && !t.scadenza && !t.progetto_id;
}

/**
 * Giorno in cui una task compare nelle viste per data: la pianificata se c'è,
 * altrimenti la scadenza.
 */
export function giornoTask(t: DateTask): string | null {
  return t.data_pianificata ?? t.scadenza;
}

/** I giorni da `oggi` a `oggi + n - 1`, per le viste a 7 giorni. */
export function prossimiGiorni(oggi: string, n = 7): string[] {
  return Array.from({ length: n }, (_, i) => addDays(oggi, i));
}

/**
 * Raggruppa per giorno (pianificata, altrimenti scadenza) nell'intervallo
 * dato. Le task in ritardo finiscono nel primo giorno.
 */
export function raggruppaPerGiorno<T extends DateTask>(tasks: T[], giorni: string[]): Map<string, T[]> {
  const gruppi = new Map(giorni.map((g) => [g, [] as T[]]));
  const primo = giorni[0];
  const ultimo = giorni.at(-1) ?? primo;
  for (const t of tasks) {
    const giorno = giornoTask(t);
    if (!giorno || giorno > ultimo) continue;
    gruppi.get(giorno < primo ? primo : giorno)?.push(t);
  }
  return gruppi;
}

/** Ordinamento standard delle liste: priorità, poi giorno, poi ordine manuale. */
export function confrontaTask(
  a: { priorita: number | null; ordine: number; created_at: string } & DateTask,
  b: { priorita: number | null; ordine: number; created_at: string } & DateTask,
): number {
  const pa = a.priorita ?? 4;
  const pb = b.priorita ?? 4;
  if (pa !== pb) return pa - pb;
  const ga = giornoTask(a) ?? "9999";
  const gb = giornoTask(b) ?? "9999";
  if (ga !== gb) return ga < gb ? -1 : 1;
  if (a.ordine !== b.ordine) return a.ordine - b.ordine;
  return a.created_at < b.created_at ? -1 : 1;
}

/**
 * Valore di `ordine` per una task inserita tra due vicine (numeri frazionari:
 * non serve rinumerare la colonna).
 */
export function ordineTra(prima: number | null, dopo: number | null): number {
  if (prima === null && dopo === null) return 0;
  if (prima === null) return (dopo as number) - 1;
  if (dopo === null) return prima + 1;
  return (prima + dopo) / 2;
}

/** Avanzamento di un progetto in percentuale intera. */
export function avanzamento(fatte: number, totali: number): number {
  return totali === 0 ? 0 : Math.round((fatte / totali) * 100);
}

/**
 * Task per la pagina Oggi: in ritardo (pianificata o scadenza superata) e di
 * oggi (pianificata oggi o in scadenza oggi). Solo task aperte.
 */
export function taskDiOggi<T extends DateTask & { priorita: number | null; ordine: number; created_at: string }>(
  tasks: T[],
  oggi: string,
): { inRitardo: T[]; perOggi: T[] } {
  const inRitardo: T[] = [];
  const perOggi: T[] = [];
  for (const t of tasks) {
    if (!isAperta(t)) continue;
    if (isPianificataInRitardo(t, oggi) || isScaduta(t, oggi)) inRitardo.push(t);
    else if (t.data_pianificata === oggi || t.scadenza === oggi) perOggi.push(t);
  }
  return { inRitardo: inRitardo.sort(confrontaTask), perOggi: perOggi.sort(confrontaTask) };
}
