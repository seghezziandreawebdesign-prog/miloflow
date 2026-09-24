import { z } from "zod";

import { normalizeUrl } from "@/lib/clienti";
import { parseImporto } from "@/lib/servizi";

const testo = z.string().trim();
const importo = testo.refine((v) => {
  const n = parseImporto(v);
  return n === null || (Number.isFinite(n) && n >= 0);
}, "Importo non valido");
const senzaNumeroCarta = testo.refine(
  (v) => !/\d{12,}/.test(v.replace(/[\s.-]/g, "")),
  "Non salvare numeri di carta completi: scrivi solo un riferimento, es. \"Revolut *4417\"",
);

export const servizioSchema = z.object({
  nome: testo.min(1, "Inserisci il nome"),
  costo: importo,
  frequenza: z.enum(["mensile", "trimestrale", "semestrale", "annuale", "biennale", "una_tantum"]),
  prossima_scadenza: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Scegli la data di scadenza"),
  clienti: z.array(z.object({ cliente_id: z.uuid(), prezzo_rivendita: importo })).max(50),
  ambito: z.enum(["lavoro", "personale"]),
  tipo_id: z.union([z.uuid(), z.literal("")]),
  fornitore: testo,
  rinnovo_automatico: z.boolean(),
  chi_paga: z.enum(["io", "cliente"]),
  metodo_pagamento: senzaNumeroCarta,
  preavviso_giorni: testo.refine((v) => v === "" || (/^\d+$/.test(v) && Number(v) <= 365), "Da 0 a 365 giorni"),
  url_pannello: testo.refine((v) => v === "" || /^(https?:\/\/)?[^\s.]+\.[^\s]+$/i.test(v), "Indirizzo non valido"),
  username: testo,
  stato: z.enum(["attivo", "disdetto", "archiviato"]),
  note: testo,
});

export type ServizioFormValues = z.infer<typeof servizioSchema>;

export function servizioVuoto(ambito: "lavoro" | "personale", scadenza: string): ServizioFormValues {
  return {
    nome: "",
    costo: "",
    frequenza: "annuale",
    prossima_scadenza: scadenza,
    clienti: [],
    ambito,
    tipo_id: "",
    fornitore: "",
    rinnovo_automatico: false,
    chi_paga: "io",
    metodo_pagamento: "",
    preavviso_giorni: "",
    url_pannello: "",
    username: "",
    stato: "attivo",
    note: "",
  };
}

const numero = (v: string) => {
  const n = parseImporto(v);
  return n === null ? "" : String(n);
};

/** Argomenti per la funzione SQL salva_servizio. */
export function servizioToRpc(v: ServizioFormValues) {
  return {
    p_servizio: {
      ambito: v.ambito,
      nome: v.nome,
      tipo_id: v.tipo_id,
      fornitore: v.fornitore,
      frequenza: v.frequenza,
      prossima_scadenza: v.prossima_scadenza,
      rinnovo_automatico: v.rinnovo_automatico,
      chi_paga: v.chi_paga,
      preavviso_giorni: v.preavviso_giorni,
      url_pannello: normalizeUrl(v.url_pannello) ?? "",
      username: v.username,
      stato: v.stato,
      note: v.note,
    },
    p_economico: { costo: numero(v.costo), valuta: "EUR", metodo_pagamento: v.metodo_pagamento },
    p_clienti: v.clienti.map((c) => ({ cliente_id: c.cliente_id, prezzo_rivendita: numero(c.prezzo_rivendita) })),
  };
}

export const rinnovoSchema = z.object({
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data non valida"),
  importo,
});
export type RinnovoFormValues = z.infer<typeof rinnovoSchema>;

export const credenzialeSchema = z.discriminatedUnion("tipo", [
  z.object({
    tipo: z.literal("link_password_manager"),
    etichetta: testo.min(1, "Inserisci un'etichetta"),
    url_password_manager: testo
      .min(1, "Inserisci il link")
      .refine((v) => /^https?:\/\/\S+$/i.test(v) || /^[a-z][a-z0-9+.-]*:\/\/\S+$/i.test(v), "Link non valido"),
  }),
  z.object({
    tipo: z.literal("cifrata"),
    etichetta: testo.min(1, "Inserisci un'etichetta"),
    payload_cifrato: z.string().min(16).max(20000),
    iv: z.string().regex(/^[A-Za-z0-9+/]{16}$/, "IV non valido"),
    salt: z.string().regex(/^[A-Za-z0-9+/]{22}==$/, "Salt non valido"),
  }),
]);
export type CredenzialeInput = z.infer<typeof credenzialeSchema>;

export const parametriCassaforteSchema = z.object({
  salt: z.string().regex(/^[A-Za-z0-9+/]{22}==$/),
  iterazioni: z.number().int().min(600_000).max(5_000_000),
  iv: z.string().regex(/^[A-Za-z0-9+/]{16}$/),
  verifica_cifrata: z.string().min(16).max(500),
});
