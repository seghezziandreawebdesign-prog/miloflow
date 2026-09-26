import { z } from "zod";

import { isPrimoDelMese } from "@/lib/budget";
import { parseImporto } from "@/lib/servizi";

export const testo = z.string().trim();
export const dataISO = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data non valida");
export const uuidOVuoto = z.union([z.uuid(), z.literal("")]);

/** Importo scritto dall'utente: vuoto ammesso, altrimenti un numero ≥ 0. */
export const importoFacoltativo = testo.refine((v) => {
  const n = parseImporto(v);
  return n === null || (Number.isFinite(n) && n >= 0);
}, "Importo non valido");

/** Importo obbligatorio e positivo. */
export const importoObbligatorio = testo.refine((v) => {
  const n = parseImporto(v);
  return n !== null && Number.isFinite(n) && n > 0;
}, "Inserisci un importo");

export const numero = (v: string) => {
  const n = parseImporto(v);
  return n === null ? null : n;
};

// ---------------------------------------------------------------------------
// Movimenti
// ---------------------------------------------------------------------------

export const movimentoSchema = z.object({
  tipo: z.enum(["spesa", "entrata"]),
  ambito: z.enum(["lavoro", "personale"]),
  data: dataISO,
  importo: importoObbligatorio,
  descrizione: testo.max(200, "Massimo 200 caratteri"),
  categoria_id: uuidOVuoto,
  stato: z.enum(["pagato", "previsto"]),
  metodo_pagamento_id: uuidOVuoto,
});
export type MovimentoFormValues = z.infer<typeof movimentoSchema>;

export function movimentoVuoto(ambito: "lavoro" | "personale", oggi: string): MovimentoFormValues {
  return { tipo: "spesa", ambito, data: oggi, importo: "", descrizione: "", categoria_id: "", stato: "pagato", metodo_pagamento_id: "" };
}

export function movimentoToDb(v: MovimentoFormValues) {
  return {
    tipo: v.tipo,
    ambito: v.ambito,
    data: v.data,
    importo: numero(v.importo) ?? 0,
    descrizione: v.descrizione || null,
    // Le categorie sono di spesa: un'entrata non ne ha.
    categoria_id: v.tipo === "entrata" ? null : v.categoria_id || null,
    stato: v.stato,
    metodo_pagamento_id: v.metodo_pagamento_id || null,
  };
}

/** "Segna pagato" di un previsto, o pagamento di una rata. */
export const pagamentoSchema = z.object({
  data: dataISO,
  importo: importoFacoltativo,
  metodo_pagamento_id: uuidOVuoto,
});
export type PagamentoFormValues = z.infer<typeof pagamentoSchema>;

export function pagamentoToRpc(v: PagamentoFormValues) {
  return { data: v.data, importo: numero(v.importo), metodo_pagamento_id: v.metodo_pagamento_id || null };
}

// ---------------------------------------------------------------------------
// Budget del mese per categoria
// ---------------------------------------------------------------------------

export const budgetMeseSchema = z.object({
  categoria_id: z.uuid(),
  mese: dataISO.refine(isPrimoDelMese, "Il mese deve essere il primo del mese"),
  /** Vuoto = torna al budget di default. */
  importo: importoFacoltativo,
});
export type BudgetMeseFormValues = z.infer<typeof budgetMeseSchema>;

// ---------------------------------------------------------------------------
// Categorie
// ---------------------------------------------------------------------------

export const categoriaSchema = z.object({
  nome: testo.min(1, "Inserisci il nome").max(60, "Massimo 60 caratteri"),
  parent_id: uuidOVuoto,
  ambito: z.enum(["lavoro", "personale", "entrambi"]),
  colore: testo.refine((v) => v === "" || /^#[0-9a-f]{6}$/i.test(v), "Colore non valido"),
  icona: testo.max(40),
  budget_default: importoFacoltativo,
});
export type CategoriaFormValues = z.infer<typeof categoriaSchema>;

export function categoriaVuota(parent_id = "", ambito: CategoriaFormValues["ambito"] = "entrambi"): CategoriaFormValues {
  return { nome: "", parent_id, ambito, colore: "", icona: "", budget_default: "" };
}

export function categoriaToDb(v: CategoriaFormValues) {
  return {
    nome: v.nome,
    parent_id: v.parent_id || null,
    ambito: v.ambito,
    colore: v.colore ? v.colore.toLowerCase() : null,
    icona: v.icona || null,
    budget_default: numero(v.budget_default),
  };
}

// ---------------------------------------------------------------------------
// Debiti con il piano delle rate
// ---------------------------------------------------------------------------

export const rataSchema = z.object({
  numero: z.number().int().positive(),
  scadenza: dataISO,
  importo: importoFacoltativo.refine((v) => (numero(v) ?? 0) > 0, "Inserisci l'importo"),
});

export const debitoSchema = z
  .object({
    ambito: z.enum(["lavoro", "personale"]),
    creditore: testo.min(1, "Inserisci il creditore").max(120),
    descrizione: testo.max(200),
    importo_totale: importoObbligatorio,
    tipo: z.enum(["rateale", "unica_soluzione", "prestito_privato"]),
    data_inizio: z.union([dataISO, z.literal("")]),
    categoria_id: uuidOVuoto,
    note: testo.max(2000),
    rate: z.array(rataSchema).max(240, "Massimo 240 rate"),
  })
  .refine((v) => new Set(v.rate.map((r) => r.numero)).size === v.rate.length, {
    message: "I numeri delle rate devono essere unici",
    path: ["rate"],
  });
export type DebitoFormValues = z.infer<typeof debitoSchema>;

export function debitoVuoto(ambito: "lavoro" | "personale", oggi: string): DebitoFormValues {
  return {
    ambito,
    creditore: "",
    descrizione: "",
    importo_totale: "",
    tipo: "rateale",
    data_inizio: oggi,
    categoria_id: "",
    note: "",
    rate: [],
  };
}

/** Argomenti per la funzione SQL salva_debito. */
export function debitoToRpc(v: DebitoFormValues) {
  return {
    p_debito: {
      ambito: v.ambito,
      creditore: v.creditore,
      descrizione: v.descrizione,
      importo_totale: String(numero(v.importo_totale) ?? 0),
      tipo: v.tipo,
      data_inizio: v.data_inizio,
      note: v.note,
      categoria_id: v.categoria_id,
    },
    p_rate: v.rate.map((r) => ({ numero: r.numero, scadenza: r.scadenza, importo: String(numero(r.importo) ?? 0) })),
  };
}
