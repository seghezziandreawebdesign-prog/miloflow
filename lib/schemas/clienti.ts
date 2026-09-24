import { z } from "zod";

import { normalizeUrl, PALETTE_CLIENTI } from "@/lib/clienti";
import type { Database } from "@/lib/supabase/database.types";
import {
  isPlausiblePivaEstera,
  isValidCodiceFiscale,
  isValidPivaIT,
  normalizePiva,
} from "@/lib/validation/fiscale";

// Gli schemi lavorano sulle stringhe del form ("" = vuoto) e sono gli stessi
// nel browser e nelle Server Actions. La conversione verso le righe del
// database è in funzioni separate.

const testo = z.string().trim();
const emailFacoltativa = testo.refine((v) => v === "" || z.email().safeParse(v).success, "Email non valida");

export const clienteSchema = z
  .object({
    tipo: z.enum(["azienda", "privato"]),
    ragione_sociale: testo.min(1, "Inserisci la ragione sociale o il nome"),
    nome_breve: testo,
    nazione: z.string().regex(/^[A-Z]{2}$/, "Paese non valido"),
    piva: testo,
    codice_fiscale: testo,
    codice_sdi: testo,
    pec: emailFacoltativa,
    indirizzo: testo,
    cap: testo,
    citta: testo,
    provincia: testo,
    email: emailFacoltativa,
    telefono: testo,
    sito: testo,
    colore: z.enum(PALETTE_CLIENTI).or(z.literal("")),
    stato: z.enum(["attivo", "potenziale", "in_pausa", "archiviato"]),
    tags: z.array(testo.min(1)).max(20),
    note: testo,
  })
  .superRefine((v, ctx) => {
    const italia = v.nazione === "IT";
    if (v.piva) {
      const piva = normalizePiva(v.piva, v.nazione);
      const ok = italia ? isValidPivaIT(piva) : isPlausiblePivaEstera(piva);
      if (!ok) {
        ctx.addIssue({
          code: "custom",
          path: ["piva"],
          message: italia ? "P.IVA non valida: controlla le 11 cifre" : "Formato P.IVA non valido",
        });
      }
    }
    if (v.codice_fiscale && italia && !isValidCodiceFiscale(v.codice_fiscale)) {
      ctx.addIssue({ code: "custom", path: ["codice_fiscale"], message: "Codice fiscale non valido" });
    }
    if (v.codice_sdi && !/^[A-Z0-9]{6,7}$/i.test(v.codice_sdi)) {
      ctx.addIssue({ code: "custom", path: ["codice_sdi"], message: "Il codice SDI ha 7 caratteri (6 per la PA)" });
    }
    if (italia && v.cap && !/^\d{5}$/.test(v.cap)) {
      ctx.addIssue({ code: "custom", path: ["cap"], message: "Il CAP ha 5 cifre" });
    }
    if (italia && v.provincia && !/^[A-Z]{2}$/i.test(v.provincia)) {
      ctx.addIssue({ code: "custom", path: ["provincia"], message: "Sigla di 2 lettere" });
    }
    if (v.sito && !/^(https?:\/\/)?[^\s.]+\.[^\s]+$/i.test(v.sito)) {
      ctx.addIssue({ code: "custom", path: ["sito"], message: "Indirizzo del sito non valido" });
    }
  });

export type ClienteFormValues = z.infer<typeof clienteSchema>;

export const clienteVuoto: ClienteFormValues = {
  tipo: "azienda",
  ragione_sociale: "",
  nome_breve: "",
  nazione: "IT",
  piva: "",
  codice_fiscale: "",
  codice_sdi: "",
  pec: "",
  indirizzo: "",
  cap: "",
  citta: "",
  provincia: "",
  email: "",
  telefono: "",
  sito: "",
  colore: "",
  stato: "attivo",
  tags: [],
  note: "",
};

type ClienteRow = Database["public"]["Tables"]["clienti"]["Row"];
type ClienteInsert = Database["public"]["Tables"]["clienti"]["Insert"];

const vuotoANull = (v: string) => (v === "" ? null : v);

export function clienteToRow(v: ClienteFormValues): ClienteInsert {
  return {
    tipo: v.tipo,
    ragione_sociale: v.ragione_sociale,
    nome_breve: vuotoANull(v.nome_breve),
    nazione: v.nazione,
    piva: v.piva ? normalizePiva(v.piva, v.nazione) : null,
    codice_fiscale: vuotoANull(v.codice_fiscale.replace(/\s/g, "").toUpperCase()),
    codice_sdi: vuotoANull(v.codice_sdi.toUpperCase()),
    pec: vuotoANull(v.pec.toLowerCase()),
    indirizzo: vuotoANull(v.indirizzo),
    cap: vuotoANull(v.cap),
    citta: vuotoANull(v.citta),
    provincia: vuotoANull(v.provincia.toUpperCase()),
    email: vuotoANull(v.email.toLowerCase()),
    telefono: vuotoANull(v.telefono),
    sito: normalizeUrl(v.sito),
    colore: vuotoANull(v.colore),
    stato: v.stato,
    tags: [...new Set(v.tags.map((t) => t.toLowerCase()))],
    note: vuotoANull(v.note),
  };
}

export function rowToClienteForm(c: ClienteRow): ClienteFormValues {
  const colore = (PALETTE_CLIENTI as readonly string[]).includes(c.colore ?? "")
    ? (c.colore as ClienteFormValues["colore"])
    : "";
  return {
    tipo: c.tipo,
    ragione_sociale: c.ragione_sociale,
    nome_breve: c.nome_breve ?? "",
    nazione: c.nazione,
    piva: c.piva ?? "",
    codice_fiscale: c.codice_fiscale ?? "",
    codice_sdi: c.codice_sdi ?? "",
    pec: c.pec ?? "",
    indirizzo: c.indirizzo ?? "",
    cap: c.cap ?? "",
    citta: c.citta ?? "",
    provincia: c.provincia ?? "",
    email: c.email ?? "",
    telefono: c.telefono ?? "",
    sito: c.sito ?? "",
    colore,
    stato: c.stato,
    tags: c.tags,
    note: c.note ?? "",
  };
}

export const contattoSchema = z.object({
  nome: testo.min(1, "Inserisci il nome"),
  ruolo: testo,
  email: emailFacoltativa,
  telefono: testo,
  principale: z.boolean(),
});
export type ContattoFormValues = z.infer<typeof contattoSchema>;

export const linkSchema = z.object({
  etichetta: testo.min(1, "Inserisci un'etichetta"),
  url: testo
    .min(1, "Inserisci l'indirizzo")
    .refine((v) => /^(https?:\/\/)?[^\s.]+\.[^\s]+$/i.test(v), "Indirizzo non valido"),
});
export type LinkFormValues = z.infer<typeof linkSchema>;

export const notaDiarioSchema = z.object({
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data non valida"),
  testo: testo.min(1, "Scrivi la nota"),
});
export type NotaDiarioFormValues = z.infer<typeof notaDiarioSchema>;
