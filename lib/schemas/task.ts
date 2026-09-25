import { z } from "zod";

import { isIsoDate } from "@/lib/dates/giorni";
import { isRRuleValida } from "@/lib/dates/ricorrenza";
import type { TaskRapida } from "@/lib/parsing/task-rapida";
import type { Database } from "@/lib/supabase/database.types";

const testo = z.string().trim();
const idFacoltativo = z.union([z.uuid(), z.literal("")]);
const dataFacoltativa = z.union([z.literal(""), z.string().refine(isIsoDate, "Data non valida")]);
export const oraFacoltativa = z.union([z.literal(""), z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Orario non valido")]);

export const taskSchema = z.object({
  titolo: testo.min(1, "Scrivi il titolo").max(500, "Titolo troppo lungo"),
  note: testo.max(10_000),
  ambito: z.enum(["lavoro", "personale"]),
  stato: z.enum(["da_fare", "in_corso", "in_attesa", "fatto"]),
  in_attesa_di: testo.max(500),
  priorita: z.enum(["", "1", "2", "3"]),
  data_pianificata: dataFacoltativa,
  /** Orario di inizio "HH:mm"; senza, la task sta nella riga "tutto il giorno" del calendario. */
  ora_inizio: oraFacoltativa,
  scadenza: dataFacoltativa,
  durata_min: testo.refine((v) => v === "" || (/^\d+$/.test(v) && Number(v) > 0 && Number(v) <= 100_000), "Minuti non validi"),
  ricorrenza: testo.refine((v) => v === "" || isRRuleValida(v), "Ricorrenza non valida"),
  progetto_id: idFacoltativo,
  cliente_id: idFacoltativo,
  servizio_id: idFacoltativo,
  parent_id: idFacoltativo,
  assegnata_a: idFacoltativo,
});

export type TaskFormValues = z.infer<typeof taskSchema>;

/** Per le modifiche puntuali dal pannello: solo i campi presenti. */
export const taskPatchSchema = taskSchema.partial();
export type TaskPatch = z.infer<typeof taskPatchSchema>;

/** Modifiche rapide sulle task selezionate. Per completarle si usa completaTasks. */
export const taskMultiplaSchema = taskSchema
  .pick({ data_pianificata: true, priorita: true, stato: true, in_attesa_di: true, progetto_id: true })
  .extend({ stato: z.enum(["da_fare", "in_corso", "in_attesa"]) })
  .partial()
  .strict();
export type TaskMultiplaPatch = z.infer<typeof taskMultiplaSchema>;

export function taskVuota(ambito: "lavoro" | "personale"): TaskFormValues {
  return {
    titolo: "",
    note: "",
    ambito,
    stato: "da_fare",
    in_attesa_di: "",
    priorita: "",
    data_pianificata: "",
    ora_inizio: "",
    scadenza: "",
    durata_min: "",
    ricorrenza: "",
    progetto_id: "",
    cliente_id: "",
    servizio_id: "",
    parent_id: "",
    assegnata_a: "",
  };
}

export type DefaultTask = Partial<TaskFormValues> & { ambito: "lavoro" | "personale" };

/**
 * Valori di una task creata con l'aggiunta rapida:
 * vuoti ← default del contesto ← dettagli del form ← quanto riconosciuto nel testo.
 */
export function taskDaRapida(
  parsed: TaskRapida,
  defaults: DefaultTask,
  dettagli: Partial<TaskFormValues> = {},
): TaskFormValues {
  const v: TaskFormValues = { ...taskVuota(defaults.ambito), ...defaults, ...dettagli, titolo: parsed.titolo };
  if (parsed.dataPianificata) v.data_pianificata = parsed.dataPianificata;
  if (parsed.scadenza) v.scadenza = parsed.scadenza;
  if (parsed.priorita) v.priorita = String(parsed.priorita) as TaskFormValues["priorita"];
  if (parsed.cliente) {
    v.cliente_id = parsed.cliente.id;
    v.ambito = "lavoro";
  }
  if (parsed.progetto) {
    v.progetto_id = parsed.progetto.id;
    if (parsed.progetto.ambito) v.ambito = parsed.progetto.ambito;
    // Il cliente di un progetto lo imposta il database.
    if (parsed.progetto.clienteId) v.cliente_id = "";
  }
  if (v.cliente_id) v.ambito = "lavoro";
  return v;
}

const nullIfEmpty = (v: string) => (v === "" ? null : v);

/** Valori del form → colonne della tabella task (solo i campi presenti). */
export function taskToDb(v: TaskPatch): Database["public"]["Tables"]["task"]["Update"] {
  const out: Database["public"]["Tables"]["task"]["Update"] = {};
  if (v.titolo !== undefined) out.titolo = v.titolo;
  if (v.note !== undefined) out.note = nullIfEmpty(v.note);
  if (v.ambito !== undefined) out.ambito = v.ambito;
  if (v.stato !== undefined) out.stato = v.stato;
  if (v.in_attesa_di !== undefined) out.in_attesa_di = nullIfEmpty(v.in_attesa_di);
  if (v.priorita !== undefined) out.priorita = v.priorita === "" ? null : Number(v.priorita);
  if (v.data_pianificata !== undefined) out.data_pianificata = nullIfEmpty(v.data_pianificata);
  if (v.ora_inizio !== undefined) out.ora_inizio = nullIfEmpty(v.ora_inizio);
  if (v.scadenza !== undefined) out.scadenza = nullIfEmpty(v.scadenza);
  if (v.durata_min !== undefined) out.durata_min = v.durata_min === "" ? null : Number(v.durata_min);
  if (v.ricorrenza !== undefined) out.ricorrenza = nullIfEmpty(v.ricorrenza);
  if (v.progetto_id !== undefined) out.progetto_id = nullIfEmpty(v.progetto_id);
  if (v.cliente_id !== undefined) out.cliente_id = nullIfEmpty(v.cliente_id);
  if (v.servizio_id !== undefined) out.servizio_id = nullIfEmpty(v.servizio_id);
  if (v.parent_id !== undefined) out.parent_id = nullIfEmpty(v.parent_id);
  if (v.assegnata_a !== undefined) out.assegnata_a = nullIfEmpty(v.assegnata_a);
  return out;
}

export const progettoSchema = z.object({
  nome: testo.min(1, "Scrivi il nome").max(200, "Nome troppo lungo"),
  ambito: z.enum(["lavoro", "personale"]),
  cliente_id: idFacoltativo,
  parent_id: idFacoltativo,
  stato: z.enum(["attivo", "in_pausa", "completato", "archiviato"]),
  scadenza: dataFacoltativa,
  colore: z.union([z.literal(""), z.string().regex(/^#[0-9a-f]{6}$/i, "Colore non valido")]),
  descrizione: testo.max(10_000),
});

export type ProgettoFormValues = z.infer<typeof progettoSchema>;

export function progettoVuoto(ambito: "lavoro" | "personale", clienteId = "", parentId = ""): ProgettoFormValues {
  return {
    nome: "",
    ambito: clienteId ? "lavoro" : ambito,
    cliente_id: clienteId,
    parent_id: parentId,
    stato: "attivo",
    scadenza: "",
    colore: "",
    descrizione: "",
  };
}

export function progettoToDb(v: ProgettoFormValues) {
  return {
    nome: v.nome,
    ambito: v.cliente_id ? ("lavoro" as const) : v.ambito,
    cliente_id: nullIfEmpty(v.cliente_id),
    parent_id: nullIfEmpty(v.parent_id),
    stato: v.stato,
    scadenza: nullIfEmpty(v.scadenza),
    colore: nullIfEmpty(v.colore),
    descrizione: nullIfEmpty(v.descrizione),
  };
}
