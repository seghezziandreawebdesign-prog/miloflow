// Budget & Spese: tipi, etichette e calcoli puri (mesi, piano rate, totali,
// report). Nessun accesso al database: tutto testabile con vitest.

import type { FiltroAmbito } from "@/lib/ambito";
import { costoAnnuo, type Frequenza } from "@/lib/servizi";
import type { Database } from "@/lib/supabase/database.types";

type Enums = Database["public"]["Enums"];
export type TipoDebito = Enums["tipo_debito"];
export type StatoMovimento = Enums["stato_movimento"];
export type AmbitoCategoria = Enums["ambito_categoria"];
export type Ambito = Enums["ambito"];

export const TIPI_DEBITO: { value: TipoDebito; label: string }[] = [
  { value: "rateale", label: "A rate" },
  { value: "unica_soluzione", label: "Unica soluzione" },
  { value: "prestito_privato", label: "Prestito privato" },
];

export function tipoDebito(value: TipoDebito) {
  return TIPI_DEBITO.find((t) => t.value === value) ?? TIPI_DEBITO[0];
}

export const AMBITI_CATEGORIA: { value: AmbitoCategoria; label: string }[] = [
  { value: "entrambi", label: "Lavoro e personale" },
  { value: "lavoro", label: "Solo lavoro" },
  { value: "personale", label: "Solo personale" },
];

// ---------------------------------------------------------------------------
// Mesi ("yyyy-MM-01")
// ---------------------------------------------------------------------------

export function primoDelMese(iso: string): string {
  return `${iso.slice(0, 7)}-01`;
}

/** Aggiunge (o toglie) mesi a un primo del mese. */
export function aggiungiMesi(meseISO: string, n: number): string {
  const anno = Number(meseISO.slice(0, 4));
  const mese = Number(meseISO.slice(5, 7)) - 1 + n;
  const a = anno + Math.floor(mese / 12);
  const m = ((mese % 12) + 12) % 12;
  return `${a}-${String(m + 1).padStart(2, "0")}-01`;
}

/** Ultimo giorno del mese ("yyyy-MM-dd"). */
export function fineDelMese(meseISO: string): string {
  const anno = Number(meseISO.slice(0, 4));
  const mese = Number(meseISO.slice(5, 7));
  const ultimo = new Date(Date.UTC(anno, mese, 0)).getUTCDate();
  return `${meseISO.slice(0, 7)}-${String(ultimo).padStart(2, "0")}`;
}

/** Aggiunge mesi a una data rispettando la fine mese (31/01 + 1 = 28/02). */
export function aggiungiMesiData(iso: string, n: number): string {
  const giorno = Number(iso.slice(8, 10));
  const mese = aggiungiMesi(primoDelMese(iso), n);
  const ultimo = Number(fineDelMese(mese).slice(8, 10));
  return `${mese.slice(0, 7)}-${String(Math.min(giorno, ultimo)).padStart(2, "0")}`;
}

/** Gli ultimi `n` mesi fino a `mese` compreso, dal più vecchio. */
export function ultimiMesi(meseISO: string, n: number): string[] {
  return Array.from({ length: n }, (_, i) => aggiungiMesi(meseISO, i - n + 1));
}

const meseLungo = new Intl.DateTimeFormat("it-IT", { timeZone: "UTC", month: "long", year: "numeric" });
const meseCorto = new Intl.DateTimeFormat("it-IT", { timeZone: "UTC", month: "short" });

function dataUtc(iso: string): Date {
  return new Date(Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10) || 1), 12));
}

/** "settembre 2026" */
export function formatMese(meseISO: string): string {
  return meseLungo.format(dataUtc(meseISO));
}

/** "set", con l'anno a gennaio o se richiesto: "gen 27". */
export function formatMeseBreve(meseISO: string, conAnno = meseISO.slice(5, 7) === "01"): string {
  const base = meseCorto.format(dataUtc(meseISO)).replace(".", "");
  return conAnno ? `${base} ${meseISO.slice(2, 4)}` : base;
}

export function isPrimoDelMese(iso: string): boolean {
  return /^\d{4}-\d{2}-01$/.test(iso);
}

// ---------------------------------------------------------------------------
// Arrotondamenti e importi
// ---------------------------------------------------------------------------

export function arrotonda(n: number): number {
  return Math.round(n * 100) / 100;
}

export function somma(valori: number[]): number {
  return arrotonda(valori.reduce((acc, v) => acc + v, 0));
}

// ---------------------------------------------------------------------------
// Categorie
// ---------------------------------------------------------------------------

export type Categoria = {
  id: string;
  nome: string;
  parent_id: string | null;
  ambito: AmbitoCategoria;
  colore: string | null;
  icona: string | null;
  budget_default: number | null;
  ordine: number;
  archiviata: boolean;
};

export type RamoCategorie = { padre: Categoria; figlie: Categoria[] };

const perOrdine = (a: Categoria, b: Categoria) => a.ordine - b.ordine || a.nome.localeCompare(b.nome, "it");

/** Albero a due livelli, ordinato. Le figlie orfane finiscono in fondo come padri. */
export function alberoCategorie(categorie: Categoria[]): RamoCategorie[] {
  const padri = categorie.filter((c) => c.parent_id === null).sort(perOrdine);
  const ids = new Set(padri.map((p) => p.id));
  const orfane = categorie.filter((c) => c.parent_id !== null && !ids.has(c.parent_id)).sort(perOrdine);
  return [...padri, ...orfane].map((padre) => ({
    padre,
    figlie: categorie.filter((c) => c.parent_id === padre.id).sort(perOrdine),
  }));
}

/** Una categoria vale per l'ambito se è "entrambi" o coincide. */
export function categoriaPerAmbito(c: Pick<Categoria, "ambito">, ambito: FiltroAmbito | Ambito): boolean {
  return ambito === "tutto" || c.ambito === "entrambi" || c.ambito === ambito;
}

/** Categorie non archiviate e valide per l'ambito, come albero. */
export function categorieScegliibili(categorie: Categoria[], ambito: FiltroAmbito | Ambito): RamoCategorie[] {
  return alberoCategorie(categorie.filter((c) => !c.archiviata && categoriaPerAmbito(c, ambito))).filter(
    (r) => !r.padre.archiviata,
  );
}

/** "Software › Hosting" oppure "Software". */
export function nomeCategoria(id: string | null, categorie: Categoria[]): string | null {
  const c = categorie.find((x) => x.id === id);
  if (!c) return null;
  const padre = c.parent_id ? categorie.find((x) => x.id === c.parent_id) : null;
  return padre ? `${padre.nome} › ${c.nome}` : c.nome;
}

/** Colore della categoria o, se manca, del padre. */
export function coloreCategoria(id: string | null, categorie: Categoria[]): string | null {
  const c = categorie.find((x) => x.id === id);
  if (!c) return null;
  if (c.colore) return c.colore;
  const padre = c.parent_id ? categorie.find((x) => x.id === c.parent_id) : null;
  return padre?.colore ?? null;
}

// ---------------------------------------------------------------------------
// Piano rate e residuo dei debiti
// ---------------------------------------------------------------------------

export type RataPiano = { numero: number; scadenza: string; importo: number };

/**
 * Piano di rate mensili uguali a partire dalla prima scadenza. I centesimi
 * che avanzano finiscono sull'ultima rata, così la somma torna esatta.
 */
export function generaPianoRate({
  totale,
  numeroRate,
  primaScadenza,
}: {
  totale: number;
  numeroRate: number;
  primaScadenza: string;
}): RataPiano[] {
  const n = Math.max(1, Math.floor(numeroRate));
  const base = Math.floor((totale / n) * 100) / 100;
  const rate: RataPiano[] = [];
  for (let i = 0; i < n; i++) {
    rate.push({ numero: i + 1, scadenza: aggiungiMesiData(primaScadenza, i), importo: base });
  }
  rate[n - 1].importo = arrotonda(totale - base * (n - 1));
  return rate;
}

export type StatoDebito = {
  pagato: number;
  residuo: number;
  ratePagate: number;
  rateTotali: number;
  /** Prima rata non pagata, per scadenza. */
  prossima: { numero: number; scadenza: string; importo: number } | null;
  /** Rate non pagate con scadenza passata. */
  inRitardo: number;
  /** Percentuale pagata, 0-100. */
  avanzamento: number;
};

export function statoDebito(
  debito: { importo_totale: number },
  rate: { numero: number; scadenza: string; importo: number; pagata: boolean }[],
  oggi: string,
): StatoDebito {
  const pagato = somma(rate.filter((r) => r.pagata).map((r) => r.importo));
  const nonPagate = rate.filter((r) => !r.pagata).sort((a, b) => a.scadenza.localeCompare(b.scadenza));
  const totale = rate.length > 0 ? somma(rate.map((r) => r.importo)) : debito.importo_totale;
  const residuo = arrotonda(Math.max(0, totale - pagato));
  return {
    pagato,
    residuo,
    ratePagate: rate.length - nonPagate.length,
    rateTotali: rate.length,
    prossima: nonPagate[0] ? { numero: nonPagate[0].numero, scadenza: nonPagate[0].scadenza, importo: nonPagate[0].importo } : null,
    inRitardo: nonPagate.filter((r) => r.scadenza < oggi).length,
    avanzamento: totale > 0 ? Math.min(100, Math.round((pagato / totale) * 100)) : 0,
  };
}

/** Residuo dopo ogni rata, in ordine di scadenza: per il grafico del debito. */
export function andamentoResiduo(
  debito: { importo_totale: number },
  rate: { scadenza: string; importo: number; pagata: boolean }[],
): { scadenza: string; residuo: number; pagata: boolean }[] {
  const ordinate = [...rate].sort((a, b) => a.scadenza.localeCompare(b.scadenza));
  const totale = ordinate.length > 0 ? somma(ordinate.map((r) => r.importo)) : debito.importo_totale;
  let residuo = totale;
  return ordinate.map((r) => {
    residuo = arrotonda(residuo - r.importo);
    return { scadenza: r.scadenza, residuo: Math.max(0, residuo), pagata: r.pagata };
  });
}

// ---------------------------------------------------------------------------
// Totali del mese
// ---------------------------------------------------------------------------

export type MovimentoBase = {
  id: string;
  ambito: Ambito;
  data: string;
  importo: number;
  stato: StatoMovimento;
  categoria_id: string | null;
  servizio_id: string | null;
  rata_id: string | null;
  metodo_pagamento_id: string | null;
};

/** Riga di v_movimenti con i tipi veri (le viste generano tutto nullable). */
export type Movimento = MovimentoBase & {
  descrizione: string | null;
  periodo: string | null;
  ricevuta_path: string | null;
  created_at: string;
  categoria_nome: string | null;
  categoria_colore: string | null;
  categoria_icona: string | null;
  categoria_parent_id: string | null;
  categoria_padre_nome: string | null;
  metodo_nome: string | null;
  metodo_cifre: string | null;
  servizio_nome: string | null;
  debito_id: string | null;
  debito_creditore: string | null;
  rata_numero: number | null;
};

/** "Software › Hosting" dalla riga della vista. */
export function etichettaCategoriaMovimento(m: Pick<Movimento, "categoria_nome" | "categoria_padre_nome">): string | null {
  if (!m.categoria_nome) return null;
  return m.categoria_padre_nome ? `${m.categoria_padre_nome} › ${m.categoria_nome}` : m.categoria_nome;
}

export type BarraCategoria = {
  categoria: Categoria | null;
  /** Budget del mese: override, oppure il default della categoria e delle figlie. */
  budget: number | null;
  /** Se il budget viene da un override del mese. */
  personalizzato: boolean;
  speso: number;
  previsto: number;
  /** speso + previsto supera il budget. */
  superato: boolean;
};

export type TotaliMese = {
  budget: number;
  speso: number;
  previsto: number;
  rimanente: number;
  barre: BarraCategoria[];
};

/** Id del padre (o la categoria stessa se è già un padre). */
function idPadre(id: string | null, categorie: Categoria[]): string | null {
  const c = categorie.find((x) => x.id === id);
  if (!c) return null;
  return c.parent_id ?? c.id;
}

/**
 * Budget di una categoria padre nel mese: l'override del mese sul padre, se
 * c'è; altrimenti il suo default più gli override o default delle figlie.
 */
export function budgetDelMese(
  ramo: RamoCategorie,
  overrides: Map<string, number>,
): { budget: number | null; personalizzato: boolean } {
  const proprio = overrides.get(ramo.padre.id);
  if (proprio !== undefined) return { budget: proprio, personalizzato: true };
  const valori = [ramo.padre.budget_default, ...ramo.figlie.map((f) => overrides.get(f.id) ?? f.budget_default)];
  const definiti = valori.filter((v): v is number => v !== null && v !== undefined);
  if (definiti.length === 0) return { budget: null, personalizzato: false };
  return { budget: somma(definiti), personalizzato: ramo.figlie.some((f) => overrides.has(f.id)) };
}

/**
 * Totali del mese per l'ambito scelto: una barra per categoria padre (le
 * figlie contano nel padre), più "Senza categoria" se serve. Le categorie
 * archiviate compaiono solo se hanno movimenti.
 */
export function totaliMese(
  movimenti: MovimentoBase[],
  categorie: Categoria[],
  budgetMensili: { categoria_id: string; importo: number }[],
  ambito: FiltroAmbito,
): TotaliMese {
  const overrides = new Map(budgetMensili.map((b) => [b.categoria_id, b.importo]));
  const inAmbito = movimenti.filter((m) => ambito === "tutto" || m.ambito === ambito);
  const perPadre = new Map<string | null, { speso: number; previsto: number }>();
  for (const m of inAmbito) {
    const chiave = idPadre(m.categoria_id, categorie);
    const acc = perPadre.get(chiave) ?? { speso: 0, previsto: 0 };
    if (m.stato === "pagato") acc.speso += m.importo;
    else acc.previsto += m.importo;
    perPadre.set(chiave, acc);
  }

  const barre: BarraCategoria[] = [];
  for (const ramo of alberoCategorie(categorie)) {
    if (!categoriaPerAmbito(ramo.padre, ambito)) continue;
    const tot = perPadre.get(ramo.padre.id);
    if (ramo.padre.archiviata && !tot) continue;
    const { budget, personalizzato } = budgetDelMese(ramo, overrides);
    const speso = arrotonda(tot?.speso ?? 0);
    const previsto = arrotonda(tot?.previsto ?? 0);
    if (budget === null && speso === 0 && previsto === 0) continue;
    barre.push({ categoria: ramo.padre, budget, personalizzato, speso, previsto, superato: budget !== null && speso + previsto > budget });
  }
  const senza = perPadre.get(null);
  if (senza) {
    barre.push({
      categoria: null,
      budget: null,
      personalizzato: false,
      speso: arrotonda(senza.speso),
      previsto: arrotonda(senza.previsto),
      superato: false,
    });
  }
  // Prima chi ha sforato, poi per quota di budget usata, poi per speso.
  barre.sort((a, b) => {
    if (a.superato !== b.superato) return a.superato ? -1 : 1;
    const qa = a.budget ? (a.speso + a.previsto) / a.budget : -1;
    const qb = b.budget ? (b.speso + b.previsto) / b.budget : -1;
    if (qa !== qb) return qb - qa;
    return b.speso + b.previsto - (a.speso + a.previsto);
  });

  const budget = somma(barre.map((b) => b.budget ?? 0));
  const speso = somma(inAmbito.filter((m) => m.stato === "pagato").map((m) => m.importo));
  const previsto = somma(inAmbito.filter((m) => m.stato === "previsto").map((m) => m.importo));
  return { budget, speso, previsto, rimanente: arrotonda(budget - speso - previsto), barre };
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

export type FettaCategoria = { id: string | null; nome: string; colore: string | null; totale: number };

/** Spesa per categoria padre (movimenti pagati), dal più alto. */
export function spesaPerCategoria(movimenti: MovimentoBase[], categorie: Categoria[]): FettaCategoria[] {
  const acc = new Map<string | null, number>();
  for (const m of movimenti) {
    if (m.stato !== "pagato") continue;
    const chiave = idPadre(m.categoria_id, categorie);
    acc.set(chiave, (acc.get(chiave) ?? 0) + m.importo);
  }
  return [...acc.entries()]
    .map(([id, totale]) => {
      const c = id ? categorie.find((x) => x.id === id) : null;
      return { id, nome: c?.nome ?? "Senza categoria", colore: c?.colore ?? null, totale: arrotonda(totale) };
    })
    .filter((f) => f.totale > 0)
    .sort((a, b) => b.totale - a.totale);
}

export type PuntoMensile = { mese: string; lavoro: number; personale: number };

/** Speso per mese (pagati), lavoro e personale, per i mesi richiesti. */
export function spesaPerMese(movimenti: MovimentoBase[], mesi: string[]): PuntoMensile[] {
  const punti = new Map(mesi.map((m) => [m, { mese: m, lavoro: 0, personale: 0 }]));
  for (const m of movimenti) {
    if (m.stato !== "pagato") continue;
    const punto = punti.get(primoDelMese(m.data));
    if (!punto) continue;
    punto[m.ambito] += m.importo;
  }
  return [...punti.values()].map((p) => ({ mese: p.mese, lavoro: arrotonda(p.lavoro), personale: arrotonda(p.personale) }));
}

/** Fisse = servizi e rate; variabili = tutto il resto (solo pagati). */
export function fisseVsVariabili(movimenti: MovimentoBase[]): { fisse: number; variabili: number } {
  const pagati = movimenti.filter((m) => m.stato === "pagato");
  const fisse = somma(pagati.filter((m) => m.servizio_id !== null || m.rata_id !== null).map((m) => m.importo));
  const variabili = somma(pagati.filter((m) => m.servizio_id === null && m.rata_id === null).map((m) => m.importo));
  return { fisse, variabili };
}

export type ServizioAbbonamento = {
  id: string;
  nome: string;
  ambito: Ambito;
  costo: number | null;
  frequenza: Frequenza;
};

/** Costo annuo degli abbonamenti attivi, con l'elenco dal più caro. */
export function abbonamentiAnnui(servizi: ServizioAbbonamento[]): {
  totale: number;
  mensile: number;
  elenco: (ServizioAbbonamento & { annuo: number })[];
} {
  const elenco = servizi
    .map((s) => ({ ...s, annuo: costoAnnuo(s.costo, s.frequenza) }))
    .filter((s) => s.annuo > 0)
    .sort((a, b) => b.annuo - a.annuo);
  const totale = somma(elenco.map((s) => s.annuo));
  return { totale, mensile: arrotonda(totale / 12), elenco };
}

export type RigaRivendita = {
  cliente_id: string;
  cliente: string;
  servizio: string;
  frequenza: Frequenza;
  prezzo_rivendita: number | null;
  costo: number | null;
};

export type MargineCliente = { cliente_id: string; cliente: string; rivendita: number; costo: number; margine: number; servizi: number };

/**
 * Margine annuo per cliente: prezzi di rivendita meno costi, entrambi
 * normalizzati su 12 mesi. Un servizio condiviso tra più clienti conta il
 * costo per ciascuno (è il margine sul singolo cliente).
 */
export function marginePerCliente(righe: RigaRivendita[]): MargineCliente[] {
  const acc = new Map<string, MargineCliente>();
  for (const r of righe) {
    const voce = acc.get(r.cliente_id) ?? { cliente_id: r.cliente_id, cliente: r.cliente, rivendita: 0, costo: 0, margine: 0, servizi: 0 };
    voce.rivendita += costoAnnuo(r.prezzo_rivendita, r.frequenza);
    voce.costo += costoAnnuo(r.costo, r.frequenza);
    voce.servizi += 1;
    acc.set(r.cliente_id, voce);
  }
  return [...acc.values()]
    .map((v) => ({ ...v, rivendita: arrotonda(v.rivendita), costo: arrotonda(v.costo), margine: arrotonda(v.rivendita - v.costo) }))
    .sort((a, b) => b.margine - a.margine);
}

export type SpesaMetodo = { id: string | null; nome: string; totale: number; movimenti: number };

/** Quanto è stato speso con ogni metodo di pagamento (solo pagati). */
export function spesaPerMetodo(
  movimenti: MovimentoBase[],
  metodi: { id: string; nome: string; ultime_cifre: string | null }[],
): SpesaMetodo[] {
  const acc = new Map<string | null, { totale: number; n: number }>();
  for (const m of movimenti) {
    if (m.stato !== "pagato") continue;
    const v = acc.get(m.metodo_pagamento_id) ?? { totale: 0, n: 0 };
    v.totale += m.importo;
    v.n += 1;
    acc.set(m.metodo_pagamento_id, v);
  }
  return [...acc.entries()]
    .map(([id, v]) => {
      const metodo = id ? metodi.find((x) => x.id === id) : null;
      const nome = metodo ? (metodo.ultime_cifre ? `${metodo.nome} •${metodo.ultime_cifre}` : metodo.nome) : "Non indicato";
      return { id, nome, totale: arrotonda(v.totale), movimenti: v.n };
    })
    .sort((a, b) => b.totale - a.totale);
}

export type RiepilogoDebiti = {
  /** Residuo complessivo oggi. */
  residuo: number;
  /** Rate pagate nel periodo (movimenti pagati con rata). */
  pagate: { numero: number; totale: number };
  /** Prossime rate da pagare, per scadenza. */
  prossime: { debito_id: string; creditore: string; numero: number; scadenza: string; importo: number }[];
  perCreditore: { debito_id: string; creditore: string; residuo: number; pagato: number; avanzamento: number; inRitardo: number }[];
};

/** Stato dei debiti per il report: residuo, rate pagate nel periodo, prossime rate. */
export function riepilogoDebiti(
  debiti: { id: string; creditore: string; importo_totale: number; debiti_rate: { numero: number; scadenza: string; importo: number; pagata: boolean }[] }[],
  movimentiPeriodo: MovimentoBase[],
  oggi: string,
  massimoProssime = 6,
): RiepilogoDebiti {
  const pagateNelPeriodo = movimentiPeriodo.filter((m) => m.stato === "pagato" && m.rata_id !== null);
  const perCreditore = debiti
    .map((d) => {
      const s = statoDebito(d, d.debiti_rate, oggi);
      return { debito_id: d.id, creditore: d.creditore, residuo: s.residuo, pagato: s.pagato, avanzamento: s.avanzamento, inRitardo: s.inRitardo };
    })
    .filter((d) => d.residuo > 0 || d.pagato > 0)
    .sort((a, b) => b.residuo - a.residuo);
  const prossime = debiti
    .flatMap((d) => d.debiti_rate.filter((r) => !r.pagata).map((r) => ({ debito_id: d.id, creditore: d.creditore, numero: r.numero, scadenza: r.scadenza, importo: r.importo })))
    .sort((a, b) => a.scadenza.localeCompare(b.scadenza))
    .slice(0, massimoProssime);
  return {
    residuo: somma(perCreditore.map((d) => d.residuo)),
    pagate: { numero: pagateNelPeriodo.length, totale: somma(pagateNelPeriodo.map((m) => m.importo)) },
    prossime,
    perCreditore,
  };
}

// ---------------------------------------------------------------------------
// Periodi dei report
// ---------------------------------------------------------------------------

export const PERIODI_REPORT = [
  { value: "mese", label: "Questo mese" },
  { value: "3mesi", label: "Ultimi 3 mesi" },
  { value: "12mesi", label: "Ultimi 12 mesi" },
  { value: "anno", label: "Quest'anno" },
] as const;
export type PeriodoReport = (typeof PERIODI_REPORT)[number]["value"];

export function isPeriodoReport(v: string | undefined): v is PeriodoReport {
  return PERIODI_REPORT.some((p) => p.value === v);
}

/** Estremi ("yyyy-MM-dd", inclusi) del periodo rispetto a oggi. */
export function intervalloReport(periodo: PeriodoReport, oggi: string): { dal: string; al: string } {
  const mese = primoDelMese(oggi);
  switch (periodo) {
    case "mese":
      return { dal: mese, al: fineDelMese(mese) };
    case "3mesi":
      return { dal: aggiungiMesi(mese, -2), al: fineDelMese(mese) };
    case "12mesi":
      return { dal: aggiungiMesi(mese, -11), al: fineDelMese(mese) };
    case "anno":
      return { dal: `${oggi.slice(0, 4)}-01-01`, al: `${oggi.slice(0, 4)}-12-31` };
  }
}
