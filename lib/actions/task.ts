"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { BUCKET_ALLEGATI } from "@/lib/allegati";
import { todayISO } from "@/lib/dates/format";
import { prossimeDateTask } from "@/lib/dates/ricorrenza";
import { progettoSchema, progettoToDb, taskMultiplaSchema, taskPatchSchema, taskSchema, taskToDb } from "@/lib/schemas/task";
import { createClient } from "@/lib/supabase/server";

import { dbErrorMessage, NESSUN_PERMESSO, sqlNull, zodFieldErrors, type ActionResult } from "./types";

const idSchema = z.uuid();
/** Selezione multipla: al massimo 200 task per volta. */
const idsSchema = z.array(z.uuid()).min(1).max(200);

function revalida() {
  revalidatePath("/oggi");
  revalidatePath("/task", "layout");
  revalidatePath("/clienti", "layout");
}

/** Le task nuove vanno in fondo: ordine crescente nel tempo. */
function ordineNuovo(): number {
  return Date.now() / 1000;
}

function erroreTask(error: { code?: string; message: string }): string {
  if (error.message.includes("un solo livello")) return "Le sottotask possono avere un solo livello";
  if (error.message.includes("non può diventare")) return "Una task con sottotask non può diventare una sottotask";
  return dbErrorMessage(error, "Salvataggio non riuscito");
}

export async function createTask(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = taskSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Controlla i campi evidenziati", fieldErrors: zodFieldErrors(parsed.error.issues) };
  }
  const values = parsed.data;
  // Una task ricorrente ha bisogno di una data da cui partire.
  if (values.ricorrenza && !values.data_pianificata && !values.scadenza) {
    values.data_pianificata = todayISO();
  }
  const supabase = await createClient();
  // L'id si genera qui: con insert().select() la policy di lettura verrebbe
  // valutata su una riga non ancora visibile.
  const id = crypto.randomUUID();
  const { error } = await supabase.from("task").insert({
    id,
    ...taskToDb(values),
    titolo: values.titolo,
    ordine: ordineNuovo(),
  });
  if (error) return { ok: false, error: erroreTask(error) };
  revalida();
  return { ok: true, data: { id } };
}

/** Modifica puntuale di uno o più campi. Per completare si usa completaTask. */
export async function updateTask(id: string, patch: unknown): Promise<ActionResult> {
  if (!idSchema.safeParse(id).success) return NESSUN_PERMESSO;
  const parsed = taskPatchSchema.safeParse(patch);
  if (!parsed.success) {
    return { ok: false, error: "Controlla i campi evidenziati", fieldErrors: zodFieldErrors(parsed.error.issues) };
  }
  if (parsed.data.stato === "fatto") return { ok: false, error: "Per completare la task usa la spunta" };
  const valori = taskToDb(parsed.data);
  if (Object.keys(valori).length === 0) return { ok: true };

  const supabase = await createClient();
  if (parsed.data.ricorrenza) {
    const { data: task } = await supabase.from("task").select("data_pianificata, scadenza").eq("id", id).maybeSingle();
    const pianificata = parsed.data.data_pianificata ?? task?.data_pianificata;
    const scadenza = parsed.data.scadenza ?? task?.scadenza;
    if (!pianificata && !scadenza) valori.data_pianificata = todayISO();
  }
  const { data, error } = await supabase.from("task").update(valori).eq("id", id).select("id");
  if (error) return { ok: false, error: erroreTask(error) };
  if (data.length === 0) return NESSUN_PERMESSO;
  revalida();
  return { ok: true };
}

/**
 * Completa la task (e se richiesto le sottotask aperte). Se è ricorrente crea
 * la prossima occorrenza, con le date calcolate qui dalla RRULE.
 */
export async function completaTask(
  id: string,
  { sottotask = false }: { sottotask?: boolean } = {},
): Promise<ActionResult<{ prossima: { id: string; data: string | null } | null }>> {
  if (!idSchema.safeParse(id).success) return NESSUN_PERMESSO;
  const supabase = await createClient();
  const { data: task } = await supabase
    .from("task")
    .select("ricorrenza, data_pianificata, scadenza, parent_id")
    .eq("id", id)
    .maybeSingle();
  if (!task) return NESSUN_PERMESSO;

  const prossime = task.parent_id ? null : prossimeDateTask(task, todayISO());
  const { data, error } = await supabase.rpc("completa_task", {
    p_id: id,
    p_sottotask: sottotask,
    p_prossima: sqlNull(prossime),
  });
  if (error) return { ok: false, error: dbErrorMessage(error, "Completamento non riuscito") };
  revalida();
  return {
    ok: true,
    data: { prossima: data ? { id: data, data: prossime?.data_pianificata ?? prossime?.scadenza ?? null } : null },
  };
}

export async function riapriTask(id: string): Promise<ActionResult> {
  if (!idSchema.safeParse(id).success) return NESSUN_PERMESSO;
  const supabase = await createClient();
  const { data, error } = await supabase.from("task").update({ stato: "da_fare" }).eq("id", id).select("id");
  if (error) return { ok: false, error: dbErrorMessage(error) };
  if (data.length === 0) return NESSUN_PERMESSO;
  revalida();
  return { ok: true };
}

const riordinoSchema = z.object({
  stato: z.enum(["da_fare", "in_corso", "in_attesa"]),
  ordine: z.number().finite(),
  in_attesa_di: z.string().trim().max(500).optional(),
});

/** Kanban: cambia colonna e posizione in un'unica scrittura. */
export async function riordinaTask(id: string, input: unknown): Promise<ActionResult> {
  const parsed = riordinoSchema.safeParse(input);
  if (!idSchema.safeParse(id).success || !parsed.success) return NESSUN_PERMESSO;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("task")
    .update({
      stato: parsed.data.stato,
      ordine: parsed.data.ordine,
      ...(parsed.data.in_attesa_di !== undefined ? { in_attesa_di: parsed.data.in_attesa_di || null } : {}),
    })
    .eq("id", id)
    .select("id");
  if (error) return { ok: false, error: dbErrorMessage(error) };
  if (data.length === 0) return NESSUN_PERMESSO;
  revalida();
  return { ok: true };
}

/**
 * Eliminazione definitiva, sottotask comprese (on delete cascade), con i loro
 * allegati. I file si tolgono prima: le policy dello Storage richiedono che la
 * task esista ancora.
 */
async function eliminaTask(ids: string[]): Promise<ActionResult<{ eliminate: number }>> {
  const supabase = await createClient();
  const { data: sottotask } = await supabase.from("task").select("id").in("parent_id", ids);
  const storage = supabase.storage.from(BUCKET_ALLEGATI);
  for (const taskId of [...ids, ...(sottotask ?? []).map((s) => s.id)]) {
    const { data: file } = await storage.list(`task/${taskId}`, { limit: 1000 });
    const percorsi = (file ?? []).filter((f) => f.id).map((f) => `task/${taskId}/${f.name}`);
    if (percorsi.length > 0) {
      const { error } = await storage.remove(percorsi);
      if (error) return { ok: false, error: "Non riesco a eliminare gli allegati: nessuna task è stata eliminata" };
    }
  }
  const { data, error } = await supabase.from("task").delete().in("id", ids).select("id");
  if (error) return { ok: false, error: dbErrorMessage(error, "Eliminazione non riuscita") };
  if (data.length === 0) return NESSUN_PERMESSO;
  revalida();
  return { ok: true, data: { eliminate: data.length } };
}

export async function deleteTask(id: string): Promise<ActionResult> {
  if (!idSchema.safeParse(id).success) return NESSUN_PERMESSO;
  const result = await eliminaTask([id]);
  return result.ok ? { ok: true } : result;
}

/** Elimina le task selezionate (con sottotask e allegati). */
export async function deleteTasks(ids: unknown): Promise<ActionResult<{ eliminate: number }>> {
  const parsed = idsSchema.safeParse(ids);
  if (!parsed.success) return NESSUN_PERMESSO;
  return eliminaTask([...new Set(parsed.data)]);
}

/** Stessa modifica su tutte le task selezionate: data di inizio, priorità, stato, progetto. */
export async function updateTasks(ids: unknown, patch: unknown): Promise<ActionResult<{ aggiornate: number }>> {
  const parsedIds = idsSchema.safeParse(ids);
  const parsed = taskMultiplaSchema.safeParse(patch);
  if (!parsedIds.success || !parsed.success) return { ok: false, error: "Modifica non valida" };
  const valori = taskToDb(parsed.data);
  // Senza data di inizio non resta nemmeno l'orario.
  if (parsed.data.data_pianificata === "") valori.ora_inizio = null;
  if (Object.keys(valori).length === 0) return { ok: true, data: { aggiornate: 0 } };
  const supabase = await createClient();
  const { data, error } = await supabase.from("task").update(valori).in("id", parsedIds.data).select("id");
  if (error) return { ok: false, error: erroreTask(error) };
  if (data.length === 0) return NESSUN_PERMESSO;
  revalida();
  return { ok: true, data: { aggiornate: data.length } };
}

/** Completa le task selezionate una per una, così le ricorrenti creano la prossima occorrenza. */
export async function completaTasks(
  ids: unknown,
  { sottotask = false }: { sottotask?: boolean } = {},
): Promise<ActionResult<{ completate: number }>> {
  const parsed = idsSchema.safeParse(ids);
  if (!parsed.success) return NESSUN_PERMESSO;
  let completate = 0;
  for (const id of new Set(parsed.data)) {
    const result = await completaTask(id, { sottotask });
    if (!result.ok) {
      return { ok: false, error: completate > 0 ? `${result.error} (completate ${completate} task prima dell'errore)` : result.error };
    }
    completate++;
  }
  return { ok: true, data: { completate } };
}

export async function saveProgetto(id: string | null, input: unknown): Promise<ActionResult<{ id: string }>> {
  if (id !== null && !idSchema.safeParse(id).success) return NESSUN_PERMESSO;
  const parsed = progettoSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Controlla i campi evidenziati", fieldErrors: zodFieldErrors(parsed.error.issues) };
  }
  const supabase = await createClient();
  const valori = progettoToDb(parsed.data);
  if (id === null) {
    const nuovo = crypto.randomUUID();
    const { error } = await supabase.from("progetti").insert({ id: nuovo, ...valori });
    if (error) return { ok: false, error: dbErrorMessage(error, "Salvataggio non riuscito") };
    revalida();
    return { ok: true, data: { id: nuovo } };
  }
  const { data, error } = await supabase.from("progetti").update(valori).eq("id", id).select("id");
  if (error) return { ok: false, error: dbErrorMessage(error, "Salvataggio non riuscito") };
  if (data.length === 0) return NESSUN_PERMESSO;
  revalida();
  return { ok: true, data: { id } };
}

const statoProgettoSchema = z.enum(["attivo", "in_pausa", "completato", "archiviato"]);

export async function setStatoProgetto(id: string, stato: string): Promise<ActionResult> {
  const parsed = statoProgettoSchema.safeParse(stato);
  if (!idSchema.safeParse(id).success || !parsed.success) return NESSUN_PERMESSO;
  const supabase = await createClient();
  const { data, error } = await supabase.from("progetti").update({ stato: parsed.data }).eq("id", id).select("id");
  if (error) return { ok: false, error: dbErrorMessage(error) };
  if (data.length === 0) return NESSUN_PERMESSO;
  revalida();
  return { ok: true };
}
