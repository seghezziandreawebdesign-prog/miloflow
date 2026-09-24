import type { Database } from "@/lib/supabase/database.types";

type Enums = Database["public"]["Enums"];
export type Frequenza = Enums["frequenza_servizio"];
export type StatoServizio = Enums["stato_servizio"];
export type ChiPaga = Enums["chi_paga"];
export type StatoScadenza = "scaduto" | "urgente" | "in_scadenza" | "ok" | "senza_scadenza";

export const FREQUENZE: { value: Frequenza; label: string; mesi: number | null }[] = [
  { value: "mensile", label: "Mensile", mesi: 1 },
  { value: "trimestrale", label: "Trimestrale", mesi: 3 },
  { value: "semestrale", label: "Semestrale", mesi: 6 },
  { value: "annuale", label: "Annuale", mesi: 12 },
  { value: "biennale", label: "Biennale", mesi: 24 },
  { value: "una_tantum", label: "Una tantum", mesi: null },
];

export const STATI_SERVIZIO: { value: StatoServizio; label: string }[] = [
  { value: "attivo", label: "Attivo" },
  { value: "disdetto", label: "Disdetto" },
  { value: "archiviato", label: "Archiviato" },
];

export const CHI_PAGA: { value: ChiPaga; label: string }[] = [
  { value: "io", label: "Pago io" },
  { value: "cliente", label: "Paga il cliente" },
];

export const STATI_SCADENZA: Record<StatoScadenza, { label: string; className: string; dot: string }> = {
  scaduto: { label: "Scaduto", className: "bg-red-50 text-red-700 ring-red-600/20", dot: "bg-scadenza-scaduto" },
  urgente: { label: "Urgente", className: "bg-orange-50 text-orange-700 ring-orange-600/20", dot: "bg-scadenza-urgente" },
  in_scadenza: { label: "In scadenza", className: "bg-yellow-50 text-yellow-800 ring-yellow-600/25", dot: "bg-scadenza-in-scadenza" },
  ok: { label: "Ok", className: "bg-emerald-50 text-emerald-700 ring-emerald-600/20", dot: "bg-scadenza-ok" },
  senza_scadenza: { label: "Senza scadenza", className: "bg-muted text-muted-foreground ring-black/8", dot: "bg-muted-foreground/50" },
};

export function frequenza(value: Frequenza) {
  return FREQUENZE.find((f) => f.value === value) ?? FREQUENZE[3];
}

/** Costo normalizzato su 12 mesi (una tantum = 0: non è ricorrente). */
export function costoAnnuo(costo: number | null, freq: Frequenza): number {
  const mesi = frequenza(freq).mesi;
  if (!costo || !mesi) return 0;
  return Math.round((costo * 12 * 100) / mesi) / 100;
}

/**
 * Stessa regola della funzione SQL scadenza_successiva: aggiunge i mesi della
 * frequenza rispettando la fine mese (31/01 + 1 mese = 28/02). Serve
 * all'anteprima nel browser; il valore salvato lo calcola il database.
 */
export function scadenzaSuccessiva(dataISO: string, freq: Frequenza): string | null {
  const mesi = frequenza(freq).mesi;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dataISO);
  if (!mesi || !match) return null;
  const anno = Number(match[1]);
  const mese = Number(match[2]) - 1 + mesi;
  const giorno = Number(match[3]);
  const annoFinale = anno + Math.floor(mese / 12);
  const meseFinale = mese % 12;
  const ultimoGiorno = new Date(Date.UTC(annoFinale, meseFinale + 1, 0)).getUTCDate();
  const d = Math.min(giorno, ultimoGiorno);
  return `${annoFinale}-${String(meseFinale + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Scadenze di un servizio che cadono tra `da` e `a` (inclusi), in "yyyy-MM-dd". */
export function scadenzeNelPeriodo(prima: string, freq: Frequenza, da: string, a: string): string[] {
  const out: string[] = [];
  let corrente: string | null = prima;
  // Si parte dalla prossima scadenza; le date sono confrontabili come stringhe.
  for (let i = 0; corrente && corrente <= a && i < 500; i++) {
    if (corrente >= da) out.push(corrente);
    corrente = scadenzaSuccessiva(corrente, freq);
  }
  return out;
}

/** Parse di un importo scritto all'italiana ("1.234,50") o all'inglese ("1234.5"). */
export function parseImporto(value: string): number | null {
  const s = value.trim().replace(/\s|€/g, "");
  if (!s) return null;
  const normalized = s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s;
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return Number.NaN;
  return Number(normalized);
}
