// Risparmi e investimenti ("salvadanai"): calcoli puri, usati dalle card, dal
// pannello e dai test.

import type { Database } from "@/lib/supabase/database.types";

export type TipoSalvadanaio = "risparmio" | "investimento";

export const TIPI_SALVADANAIO: Record<TipoSalvadanaio, { singolare: string; plurale: string; nuovo: string; icona: string }> = {
  risparmio: { singolare: "Risparmio", plurale: "Risparmi", nuovo: "Nuovo obiettivo", icona: "piggy-bank" },
  investimento: { singolare: "Investimento", plurale: "Investimenti", nuovo: "Nuovo investimento", icona: "trending-up" },
};

const arrotonda = (n: number) => Math.round(n * 100) / 100;

/** Percentuale (0-100) del saldo rispetto all'obiettivo; null senza obiettivo. */
export function avanzamentoObiettivo(saldo: number, obiettivo: number | null): number | null {
  if (!obiettivo || obiettivo <= 0) return null;
  return Math.max(0, Math.min(100, Math.round((saldo / obiettivo) * 100)));
}

/** Mesi da quello di `oggi` a quello di `data` ("yyyy-MM-dd"): settembre → dicembre = 3. */
export function mesiTra(oggi: string, data: string): number {
  const a = Number(oggi.slice(0, 4)) * 12 + Number(oggi.slice(5, 7));
  const b = Number(data.slice(0, 4)) * 12 + Number(data.slice(5, 7));
  return b - a;
}

export type Ritmo =
  | { stato: "raggiunto" }
  | { stato: "scaduto"; mancano: number }
  | { stato: "in_corso"; mancano: number; mesi: number; alMese: number };

/**
 * Quanto versare al mese per arrivare all'obiettivo entro la data. Il mese
 * della scadenza conta; se la data è in questo mese resta un solo versamento.
 * Null senza obiettivo o senza data.
 */
export function ritmoObiettivo(
  s: { saldo: number; obiettivo: number | null; data_obiettivo: string | null },
  oggi: string,
): Ritmo | null {
  if (!s.obiettivo || s.obiettivo <= 0) return null;
  const mancano = arrotonda(s.obiettivo - s.saldo);
  if (mancano <= 0) return { stato: "raggiunto" };
  if (!s.data_obiettivo) return null;
  if (s.data_obiettivo < oggi) return { stato: "scaduto", mancano };
  const mesi = Math.max(1, mesiTra(oggi, s.data_obiettivo));
  return { stato: "in_corso", mancano, mesi, alMese: Math.ceil((mancano / mesi) * 100) / 100 };
}

/** Guadagno o perdita di un investimento: valore attuale contro saldo versato. */
export function rendimento(saldo: number, valore: number | null): { euro: number; percento: number | null } | null {
  if (valore === null) return null;
  const euro = arrotonda(valore - saldo);
  return { euro, percento: saldo > 0 ? Math.round((euro / saldo) * 1000) / 10 : null };
}

export type PuntoInvestimento = { data: string; versato: number; valore: number | null };

/**
 * Serie per il grafico di un investimento: a ogni data il netto versato fino
 * a quel giorno e, dove c'è, il valore registrato.
 */
export function serieInvestimento(
  versamenti: { data: string; importo: number }[],
  prelievi: { data: string; importo: number }[],
  valori: { data: string; valore: number }[],
): PuntoInvestimento[] {
  const variazioni = new Map<string, number>();
  for (const v of versamenti) variazioni.set(v.data, (variazioni.get(v.data) ?? 0) + v.importo);
  for (const p of prelievi) variazioni.set(p.data, (variazioni.get(p.data) ?? 0) - p.importo);
  const valorePer = new Map(valori.map((v) => [v.data, v.valore]));
  const date = [...new Set([...variazioni.keys(), ...valorePer.keys()])].sort();
  let versato = 0;
  return date.map((data) => {
    versato = arrotonda(versato + (variazioni.get(data) ?? 0));
    return { data, versato, valore: valorePer.get(data) ?? null };
  });
}

/** Totali di una lista di salvadanai (per l'intestazione della tab). */
export function totaliSalvadanai(lista: { saldo: number; valore_attuale: number | null; archiviato: boolean }[]) {
  const attivi = lista.filter((s) => !s.archiviato);
  const saldo = arrotonda(attivi.reduce((acc, s) => acc + s.saldo, 0));
  // Il valore totale usa il saldo per chi non ha ancora una valutazione.
  const conValore = attivi.some((s) => s.valore_attuale !== null);
  const valore = conValore ? arrotonda(attivi.reduce((acc, s) => acc + (s.valore_attuale ?? s.saldo), 0)) : null;
  return { saldo, valore, rendimento: rendimento(saldo, valore) };
}

/**
 * Categoria proposta per i versamenti: la sottocategoria "Risparmi" o
 * "Investimenti" di "Risparmi e investimenti" (create dalla migration).
 */
export function categoriaPredefinita(
  categorie: { id: string; nome: string; parent_id: string | null; archiviata: boolean }[],
  tipo: TipoSalvadanaio,
): string {
  const nome = TIPI_SALVADANAIO[tipo].plurale.toLowerCase();
  const padri = new Set(categorie.filter((c) => c.parent_id === null && c.nome.toLowerCase() === "risparmi e investimenti").map((c) => c.id));
  const trovata =
    categorie.find((c) => !c.archiviata && c.parent_id !== null && padri.has(c.parent_id) && c.nome.toLowerCase() === nome) ??
    categorie.find((c) => !c.archiviata && c.nome.toLowerCase() === nome);
  return trovata?.id ?? "";
}

/** ISIN: due lettere del paese, nove caratteri, una cifra di controllo. */
export function isIsin(v: string): boolean {
  return /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(v);
}

type RigaVista = Database["public"]["Views"]["v_salvadanai"]["Row"];

/** Riga di v_salvadanai con i tipi veri (le viste generano tutto nullable). */
export function normalizzaSalvadanaio(r: RigaVista) {
  return {
    id: r.id!,
    tipo: r.tipo!,
    ambito: r.ambito!,
    nome: r.nome!,
    obiettivo: r.obiettivo,
    data_obiettivo: r.data_obiettivo,
    strumento: r.strumento,
    isin: r.isin,
    piattaforma: r.piattaforma,
    importo_mensile: r.importo_mensile,
    giorno_mensile: r.giorno_mensile,
    piano_attivo: r.piano_attivo ?? true,
    categoria_id: r.categoria_id,
    metodo_pagamento_id: r.metodo_pagamento_id,
    colore: r.colore,
    icona: r.icona,
    archiviato: r.archiviato ?? false,
    note: r.note,
    created_at: r.created_at!,
    versato: r.versato ?? 0,
    prelevato: r.prelevato ?? 0,
    saldo: r.saldo ?? 0,
    versamenti: r.versamenti ?? 0,
    ultimo_versamento: r.ultimo_versamento,
    previsto_id: r.previsto_id,
    previsto_data: r.previsto_data,
    previsto_importo: r.previsto_importo,
    valore_attuale: r.valore_attuale,
    valore_data: r.valore_data,
  };
}
export type Salvadanaio = ReturnType<typeof normalizzaSalvadanaio>;
