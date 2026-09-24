import type { Database } from "@/lib/supabase/database.types";

export type StatoCliente = Database["public"]["Enums"]["stato_cliente"];
export type TipoCliente = Database["public"]["Enums"]["tipo_cliente"];

export const STATI_CLIENTE: { value: StatoCliente; label: string; className: string }[] = [
  { value: "attivo", label: "Attivo", className: "bg-emerald-50 text-emerald-700 ring-emerald-600/20" },
  { value: "potenziale", label: "Potenziale", className: "bg-sky-50 text-sky-700 ring-sky-600/20" },
  { value: "in_pausa", label: "In pausa", className: "bg-amber-50 text-amber-800 ring-amber-600/20" },
  { value: "archiviato", label: "Archiviato", className: "bg-muted text-muted-foreground ring-foreground/10" },
];

export const TIPI_CLIENTE: { value: TipoCliente; label: string }[] = [
  { value: "azienda", label: "Azienda" },
  { value: "privato", label: "Privato" },
];

export function statoCliente(value: StatoCliente) {
  return STATI_CLIENTE.find((s) => s.value === value) ?? STATI_CLIENTE[0];
}

// Colori proposti per i clienti (logo di ripiego, badge).
export const PALETTE_CLIENTI = [
  "#2563eb", "#0891b2", "#059669", "#65a30d", "#ca8a04",
  "#ea580c", "#dc2626", "#db2777", "#9333ea", "#475569",
] as const;

// Paesi UE (interrogabili su VIES) più alcuni extra-UE frequenti.
export const PAESI_VIES = [
  "IT", "AT", "BE", "BG", "CY", "CZ", "DE", "DK", "EE", "ES", "FI", "FR", "GR", "HR",
  "HU", "IE", "LT", "LU", "LV", "MT", "NL", "PL", "PT", "RO", "SE", "SI", "SK",
] as const;
const PAESI_EXTRA = ["CH", "GB", "SM", "US"] as const;

const nomiPaesi = new Intl.DisplayNames(["it"], { type: "region" });

export const PAESI = [...PAESI_VIES, ...PAESI_EXTRA].map((code) => ({
  value: code,
  label: nomiPaesi.of(code) ?? code,
}));

export function isPaeseVies(nazione: string): boolean {
  return (PAESI_VIES as readonly string[]).includes(nazione);
}

/** Nome da mostrare: nome breve se c'è, altrimenti ragione sociale. */
export function nomeCliente(c: { nome_breve: string | null; ragione_sociale: string }): string {
  return c.nome_breve?.trim() || c.ragione_sociale;
}

/** Fino a due iniziali: "Studio Rossi & C." → "SR". */
export function iniziali(nome: string): string {
  const parole = nome
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (parole.length === 0) return "?";
  if (parole.length === 1) return parole[0].slice(0, 2).toUpperCase();
  return (parole[0][0] + parole[1][0]).toUpperCase();
}

/** Aggiunge https:// se manca. Stringa vuota → null. */
export function normalizeUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

/** Dominio di un sito, per la favicon. null se non è un URL valido. */
export function hostDelSito(sito: string | null): string | null {
  if (!sito) return null;
  try {
    return new URL(normalizeUrl(sito) ?? "").host || null;
  } catch {
    return null;
  }
}
