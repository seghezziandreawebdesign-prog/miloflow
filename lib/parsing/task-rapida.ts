// Parser dell'aggiunta rapida delle task, in italiano.
//
//   "Chiamare fornitore domani #onis !alta"
//   → titolo "Chiamare fornitore", pianificata domani, cliente Onis, priorità alta
//
// Riconosce:
// - date: oggi, domani, dopodomani, giorni della settimana (lun, lunedì, …:
//   la prossima occorrenza, mai oggi), "tra N giorni/settimane", dd/mm, dd/mm/yyyy.
//   Una data semplice è la data pianificata; preceduta da "entro" è la scadenza;
// - #nome → progetto o cliente (a parità di nome vince il progetto);
// - !alta !media !bassa oppure !1 !2 !3 → priorità.
// Il resto è il titolo. Funzione pura: "oggi" arriva dall'esterno.

import { addDays, isoFromParts, weekdayIndex } from "@/lib/dates/giorni";

export type Priorita = 1 | 2 | 3;

export type RiferimentoRapido = {
  tipo: "cliente" | "progetto";
  id: string;
  nome: string;
  /** Nomi alternativi riconosciuti (es. ragione sociale oltre al nome breve). */
  alias?: string[];
  /** Per i progetti: cliente e ambito del progetto. */
  clienteId?: string | null;
  ambito?: "lavoro" | "personale";
};

export type TaskRapida = {
  titolo: string;
  dataPianificata: string | null;
  scadenza: string | null;
  priorita: Priorita | null;
  progetto: RiferimentoRapido | null;
  cliente: RiferimentoRapido | null;
  /** #nomi scritti ma non trovati: restano nel titolo. */
  nonTrovati: string[];
};

const PRIORITA: Record<string, Priorita> = { alta: 1, "1": 1, media: 2, "2": 2, bassa: 3, "3": 3 };

const GIORNI: Record<string, number> = {
  lun: 0, lunedi: 0,
  mar: 1, martedi: 1,
  mer: 2, mercoledi: 2,
  gio: 3, giovedi: 3,
  ven: 4, venerdi: 4,
  sab: 5, sabato: 5,
  dom: 6, domenica: 6,
};

// Parole che introducono una data e che, prima di una data riconosciuta, non
// fanno parte del titolo: "per domani", "il 12/10", "entro il venerdì".
const ARTICOLI = new Set(["il", "l", "lo", "la"]);

/** Minuscolo, senza accenti. */
export function normalizza(testo: string): string {
  return testo.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

/** Forma da scrivere dopo #: "Sito Rossi & C." → "sito-rossi-c", "Onis S.r.l." → "onis-srl". */
export function slugRiferimento(nome: string): string {
  return normalizza(nome).replace(/\./g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function pulisci(token: string): string {
  return normalizza(token).replace(/[.,;:]+$/, "");
}

/**
 * Prova a leggere una data a partire dal token i.
 * Restituisce la data e quanti token ha consumato.
 */
function leggiData(tokens: string[], i: number, oggi: string): { data: string; usati: number } | null {
  const t = pulisci(tokens[i]);

  if (t === "oggi") return { data: oggi, usati: 1 };
  if (t === "domani") return { data: addDays(oggi, 1), usati: 1 };
  if (t === "dopodomani") return { data: addDays(oggi, 2), usati: 1 };

  if (t in GIORNI) {
    const diff = (GIORNI[t] - weekdayIndex(oggi) + 7) % 7 || 7;
    return { data: addDays(oggi, diff), usati: 1 };
  }

  if ((t === "tra" || t === "fra") && i + 2 < tokens.length) {
    const n = Number(pulisci(tokens[i + 1]));
    const unita = pulisci(tokens[i + 2]);
    if (Number.isInteger(n) && n > 0 && n <= 999) {
      if (unita === "giorno" || unita === "giorni") return { data: addDays(oggi, n), usati: 3 };
      if (unita === "settimana" || unita === "settimane") return { data: addDays(oggi, n * 7), usati: 3 };
    }
  }

  const m = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{2}|\d{4}))?$/.exec(t);
  if (m) {
    const giorno = Number(m[1]);
    const mese = Number(m[2]);
    if (m[3]) {
      const anno = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
      const data = isoFromParts(anno, mese, giorno);
      return data ? { data, usati: 1 } : null;
    }
    // Senza anno: quest'anno, o il prossimo se la data è già passata.
    const annoCorrente = Number(oggi.slice(0, 4));
    const data = isoFromParts(annoCorrente, mese, giorno);
    if (data && data >= oggi) return { data, usati: 1 };
    const prossimo = isoFromParts(annoCorrente + 1, mese, giorno);
    return prossimo ? { data: prossimo, usati: 1 } : null;
  }

  return null;
}

function cercaRiferimento(slug: string, riferimenti: RiferimentoRapido[]): RiferimentoRapido | null {
  const corrisponde = (r: RiferimentoRapido) =>
    [r.nome, ...(r.alias ?? [])].some((n) => slugRiferimento(n) === slug);
  return (
    riferimenti.find((r) => r.tipo === "progetto" && corrisponde(r)) ??
    riferimenti.find((r) => r.tipo === "cliente" && corrisponde(r)) ??
    null
  );
}

export function parseTaskRapida(
  testo: string,
  { oggi, riferimenti = [] }: { oggi: string; riferimenti?: RiferimentoRapido[] },
): TaskRapida {
  const tokens = testo.split(/\s+/).filter(Boolean);
  const titolo: string[] = [];
  const out: TaskRapida = {
    titolo: "",
    dataPianificata: null,
    scadenza: null,
    priorita: null,
    progetto: null,
    cliente: null,
    nonTrovati: [],
  };

  let i = 0;
  while (i < tokens.length) {
    const token = tokens[i];
    const t = pulisci(token);

    if (t.startsWith("!") && t.slice(1) in PRIORITA) {
      out.priorita = PRIORITA[t.slice(1)];
      i += 1;
      continue;
    }

    if (t.startsWith("#") && t.length > 1) {
      const slug = slugRiferimento(t.slice(1));
      const trovato = slug ? cercaRiferimento(slug, riferimenti) : null;
      if (trovato?.tipo === "progetto") out.progetto = trovato;
      else if (trovato) out.cliente = trovato;
      else {
        out.nonTrovati.push(token.replace(/[.,;:]+$/, ""));
        titolo.push(token);
      }
      i += 1;
      continue;
    }

    // "entro [il] <data>" → scadenza
    if (t === "entro") {
      const j = i + 1 < tokens.length && ARTICOLI.has(pulisci(tokens[i + 1])) ? i + 2 : i + 1;
      const data = j < tokens.length ? leggiData(tokens, j, oggi) : null;
      if (data) {
        out.scadenza = data.data;
        i = j + data.usati;
        continue;
      }
    }

    // "[per|il] <data>" → data pianificata
    if ((t === "per" || ARTICOLI.has(t)) && i + 1 < tokens.length) {
      const data = leggiData(tokens, i + 1, oggi);
      if (data) {
        out.dataPianificata = data.data;
        i += 1 + data.usati;
        continue;
      }
    }

    const data = leggiData(tokens, i, oggi);
    if (data) {
      out.dataPianificata = data.data;
      i += data.usati;
      continue;
    }

    titolo.push(token);
    i += 1;
  }

  out.titolo = titolo.join(" ").trim();
  return out;
}

/**
 * Il #nome che si sta scrivendo alla posizione del cursore, per
 * l'autocompletamento. null se il cursore non è dentro un #nome.
 */
export function riferimentoInScrittura(
  testo: string,
  cursore: number,
): { query: string; inizio: number; fine: number } | null {
  const prima = testo.slice(0, cursore);
  const m = /(^|\s)#([^\s#]*)$/.exec(prima);
  if (!m) return null;
  const inizio = cursore - m[2].length - 1;
  const dopo = /^[^\s]*/.exec(testo.slice(cursore))?.[0] ?? "";
  return { query: m[2] + dopo, inizio, fine: cursore + dopo.length };
}

/** Riferimenti che iniziano (o in subordine contengono) il testo cercato. */
export function suggerisciRiferimenti(
  query: string,
  riferimenti: RiferimentoRapido[],
  limite = 6,
): RiferimentoRapido[] {
  const q = slugRiferimento(query);
  const slugs = (r: RiferimentoRapido) => [r.nome, ...(r.alias ?? [])].map(slugRiferimento);
  const iniziano = riferimenti.filter((r) => slugs(r).some((s) => s.startsWith(q)));
  const contengono = riferimenti.filter((r) => !iniziano.includes(r) && slugs(r).some((s) => s.includes(q)));
  return [...iniziano, ...contengono].slice(0, limite);
}

/** Sostituisce il #nome in scrittura con quello scelto, seguito da uno spazio. */
export function inserisciRiferimento(
  testo: string,
  posizione: { inizio: number; fine: number },
  riferimento: RiferimentoRapido,
): { testo: string; cursore: number } {
  const inserito = `#${slugRiferimento(riferimento.nome)} `;
  const resto = testo.slice(posizione.fine).replace(/^\s+/, "");
  return {
    testo: testo.slice(0, posizione.inizio) + inserito + resto,
    cursore: posizione.inizio + inserito.length,
  };
}
