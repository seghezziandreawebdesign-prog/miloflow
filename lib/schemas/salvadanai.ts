import { z } from "zod";

import { isIsin, type TipoSalvadanaio } from "@/lib/salvadanai";

import { dataISO, importoFacoltativo, importoObbligatorio, numero, testo, uuidOVuoto } from "./budget";

const giorno = testo.refine((v) => v === "" || (/^\d{1,2}$/.test(v) && Number(v) >= 1 && Number(v) <= 28), "Un giorno da 1 a 28");

export const salvadanaioSchema = z
  .object({
    tipo: z.enum(["risparmio", "investimento"]),
    ambito: z.enum(["lavoro", "personale"]),
    nome: testo.min(1, "Inserisci il nome").max(200, "Massimo 200 caratteri"),
    obiettivo: importoFacoltativo,
    data_obiettivo: z.union([dataISO, z.literal("")]),
    strumento: testo.max(200),
    isin: testo
      .transform((v) => v.toUpperCase().replace(/\s/g, ""))
      .refine((v) => v === "" || isIsin(v), "ISIN non valido (es. IE00BK5BQT80)"),
    piattaforma: testo.max(120),
    importo_mensile: importoFacoltativo,
    giorno_mensile: giorno,
    piano_attivo: z.boolean(),
    categoria_id: uuidOVuoto,
    metodo_pagamento_id: uuidOVuoto,
    colore: testo.refine((v) => v === "" || /^#[0-9a-f]{6}$/i.test(v), "Colore non valido"),
    note: testo.max(2000),
  })
  .refine((v) => ((numero(v.importo_mensile) ?? 0) > 0) === (v.giorno_mensile !== ""), {
    message: "Per il piano servono sia l'importo sia il giorno",
    path: ["giorno_mensile"],
  });
export type SalvadanaioFormValues = z.input<typeof salvadanaioSchema>;

export function salvadanaioVuoto(tipo: TipoSalvadanaio, ambito: "lavoro" | "personale", categoria_id = ""): SalvadanaioFormValues {
  return {
    tipo,
    ambito,
    nome: "",
    obiettivo: "",
    data_obiettivo: "",
    strumento: "",
    isin: "",
    piattaforma: "",
    importo_mensile: "",
    giorno_mensile: "",
    piano_attivo: true,
    categoria_id,
    metodo_pagamento_id: "",
    colore: "",
    note: "",
  };
}

export function salvadanaioToDb(v: z.output<typeof salvadanaioSchema>) {
  const investimento = v.tipo === "investimento";
  const mensile = numero(v.importo_mensile);
  return {
    tipo: v.tipo,
    ambito: v.ambito,
    nome: v.nome,
    // Obiettivo e data valgono per i risparmi, strumento e ISIN per gli investimenti.
    obiettivo: investimento ? null : numero(v.obiettivo),
    data_obiettivo: investimento ? null : v.data_obiettivo || null,
    strumento: investimento ? v.strumento || null : null,
    isin: investimento ? v.isin || null : null,
    piattaforma: v.piattaforma || null,
    importo_mensile: mensile && mensile > 0 ? mensile : null,
    giorno_mensile: mensile && mensile > 0 && v.giorno_mensile ? Number(v.giorno_mensile) : null,
    piano_attivo: v.piano_attivo,
    categoria_id: v.categoria_id || null,
    metodo_pagamento_id: v.metodo_pagamento_id || null,
    colore: v.colore ? v.colore.toLowerCase() : null,
    note: v.note || null,
  };
}

/** Prelievo da un salvadanaio (soldi che tornano disponibili): non tocca il budget. */
export const prelievoSchema = z.object({
  data: dataISO,
  importo: importoObbligatorio,
  note: testo.max(500),
});
export type PrelievoFormValues = z.infer<typeof prelievoSchema>;

/** Valore di un investimento a una data. */
export const valoreSchema = z.object({
  data: dataISO,
  importo: importoFacoltativo.refine((v) => numero(v) !== null, "Inserisci il valore"),
  note: testo.max(500),
});
export type ValoreFormValues = z.infer<typeof valoreSchema>;
