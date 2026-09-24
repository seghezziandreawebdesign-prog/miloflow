import { z } from "zod";

import { addDays, isIsoDate } from "@/lib/dates/giorni";
import { fromLocalDateTime, localDateTime } from "@/lib/dates/format";
import { isRRuleValida } from "@/lib/dates/ricorrenza";
import type { Database } from "@/lib/supabase/database.types";

import { oraFacoltativa } from "./task";

const testo = z.string().trim();
const idFacoltativo = z.union([z.uuid(), z.literal("")]);
const data = z.string().refine(isIsoDate, "Data non valida");

export const eventoSchema = z
  .object({
    titolo: testo.min(1, "Scrivi il titolo").max(500, "Titolo troppo lungo"),
    ambito: z.enum(["lavoro", "personale"]),
    tutto_il_giorno: z.boolean(),
    data_inizio: data,
    ora_inizio: oraFacoltativa,
    data_fine: z.union([z.literal(""), data]),
    ora_fine: oraFacoltativa,
    luogo: testo.max(500),
    link_call: testo.max(2000).refine((v) => v === "" || /^https?:\/\//i.test(v), "Deve iniziare con http:// o https://"),
    cliente_id: idFacoltativo,
    progetto_id: idFacoltativo,
    ricorrenza: testo.refine((v) => v === "" || isRRuleValida(v), "Ricorrenza non valida"),
    note: testo.max(10_000),
    colore: testo.refine((v) => v === "" || /^#[0-9a-f]{6}$/i.test(v), "Colore non valido"),
  })
  .superRefine((v, ctx) => {
    if (!v.tutto_il_giorno && !v.ora_inizio) {
      ctx.addIssue({ code: "custom", path: ["ora_inizio"], message: "Scegli l'ora, oppure «Tutto il giorno»" });
    }
    const { inizio, fine } = istantiEvento(v);
    if (fine && fine < inizio) {
      ctx.addIssue({ code: "custom", path: ["data_fine"], message: "La fine è prima dell'inizio" });
    }
  });

export type EventoFormValues = z.infer<typeof eventoSchema>;

/** Inizio e fine come istanti, a partire dai campi del form. */
export function istantiEvento(v: Pick<EventoFormValues, "tutto_il_giorno" | "data_inizio" | "ora_inizio" | "data_fine" | "ora_fine">) {
  if (v.tutto_il_giorno) {
    return {
      inizio: fromLocalDateTime(`${v.data_inizio}T00:00`),
      // Per FullCalendar e per il feed la fine di un evento a giornata intera è esclusiva: il giorno dopo.
      fine: v.data_fine ? fromLocalDateTime(`${addDays(v.data_fine, 1)}T00:00`) : null,
    };
  }
  const inizio = fromLocalDateTime(`${v.data_inizio}T${v.ora_inizio || "00:00"}`);
  const fine = v.ora_fine ? fromLocalDateTime(`${v.data_fine || v.data_inizio}T${v.ora_fine}`) : null;
  return { inizio, fine };
}

export function eventoVuoto(
  ambito: "lavoro" | "personale",
  defaults: Partial<EventoFormValues> = {},
): EventoFormValues {
  return {
    titolo: "",
    ambito,
    tutto_il_giorno: false,
    data_inizio: "",
    ora_inizio: "",
    data_fine: "",
    ora_fine: "",
    luogo: "",
    link_call: "",
    cliente_id: "",
    progetto_id: "",
    ricorrenza: "",
    note: "",
    colore: "",
    ...defaults,
  };
}

const nullIfEmpty = (v: string) => (v === "" ? null : v);

/** Valori del form → colonne della tabella eventi. */
export function eventoToDb(v: EventoFormValues): Database["public"]["Tables"]["eventi"]["Insert"] {
  const { inizio, fine } = istantiEvento(v);
  return {
    titolo: v.titolo,
    ambito: v.cliente_id ? "lavoro" : v.ambito,
    tutto_il_giorno: v.tutto_il_giorno,
    inizio: inizio.toISOString(),
    fine: fine ? fine.toISOString() : null,
    luogo: nullIfEmpty(v.luogo),
    link_call: nullIfEmpty(v.link_call),
    cliente_id: nullIfEmpty(v.cliente_id),
    progetto_id: nullIfEmpty(v.progetto_id),
    ricorrenza: nullIfEmpty(v.ricorrenza),
    note: nullIfEmpty(v.note),
    colore: v.colore ? v.colore.toLowerCase() : null,
  };
}

type RigaEvento = Pick<
  Database["public"]["Tables"]["eventi"]["Row"],
  "titolo" | "ambito" | "tutto_il_giorno" | "inizio" | "fine" | "luogo" | "link_call" | "cliente_id" | "progetto_id" | "ricorrenza" | "note" | "colore"
>;

/** Riga del database → valori del form (ora di Roma). */
export function eventoToForm(e: RigaEvento): EventoFormValues {
  const inizio = localDateTime(e.inizio);
  const fine = e.fine ? localDateTime(e.fine) : null;
  let dataFine = fine ? fine.slice(0, 10) : "";
  // A giornata intera la fine salvata è esclusiva (mezzanotte del giorno dopo).
  if (e.tutto_il_giorno && fine) dataFine = addDays(fine.slice(0, 10), -1);
  if (dataFine === inizio.slice(0, 10)) dataFine = "";
  return {
    titolo: e.titolo,
    ambito: e.ambito,
    tutto_il_giorno: e.tutto_il_giorno,
    data_inizio: inizio.slice(0, 10),
    ora_inizio: e.tutto_il_giorno ? "" : inizio.slice(11, 16),
    data_fine: dataFine,
    ora_fine: e.tutto_il_giorno || !fine ? "" : fine.slice(11, 16),
    luogo: e.luogo ?? "",
    link_call: e.link_call ?? "",
    cliente_id: e.cliente_id ?? "",
    progetto_id: e.progetto_id ?? "",
    ricorrenza: e.ricorrenza ?? "",
    note: e.note ?? "",
    colore: e.colore ?? "",
  };
}

/** Spostamento dal calendario: nuovi istanti di inizio e fine. */
export const spostamentoEventoSchema = z.object({
  inizio: z.iso.datetime({ offset: true }),
  fine: z.union([z.null(), z.iso.datetime({ offset: true })]),
  tutto_il_giorno: z.boolean(),
});
export type SpostamentoEvento = z.infer<typeof spostamentoEventoSchema>;
