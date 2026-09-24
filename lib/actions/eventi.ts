"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { eventoSchema, eventoToDb, spostamentoEventoSchema } from "@/lib/schemas/eventi";
import { createClient } from "@/lib/supabase/server";

import { dbErrorMessage, NESSUN_PERMESSO, zodFieldErrors, type ActionResult } from "./types";

const idSchema = z.uuid();

function revalida() {
  revalidatePath("/oggi");
  revalidatePath("/calendario");
  revalidatePath("/clienti", "layout");
}

export async function saveEvento(id: string | null, input: unknown): Promise<ActionResult<{ id: string }>> {
  if (id !== null && !idSchema.safeParse(id).success) return NESSUN_PERMESSO;
  const parsed = eventoSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Controlla i campi evidenziati", fieldErrors: zodFieldErrors(parsed.error.issues) };
  }
  const supabase = await createClient();
  const valori = eventoToDb(parsed.data);
  if (id === null) {
    // L'id si genera qui: con insert().select() la policy di lettura verrebbe
    // valutata su una riga non ancora visibile.
    const nuovo = crypto.randomUUID();
    const { error } = await supabase.from("eventi").insert({ id: nuovo, ...valori });
    if (error) return { ok: false, error: dbErrorMessage(error, "Salvataggio non riuscito") };
    revalida();
    return { ok: true, data: { id: nuovo } };
  }
  const { data, error } = await supabase.from("eventi").update(valori).eq("id", id).select("id");
  if (error) return { ok: false, error: dbErrorMessage(error, "Salvataggio non riuscito") };
  if (data.length === 0) return NESSUN_PERMESSO;
  revalida();
  return { ok: true, data: { id } };
}

/** Trascinamento o ridimensionamento nel calendario. */
export async function spostaEvento(id: string, input: unknown): Promise<ActionResult> {
  const parsed = spostamentoEventoSchema.safeParse(input);
  if (!idSchema.safeParse(id).success || !parsed.success) return NESSUN_PERMESSO;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("eventi")
    .update({ inizio: parsed.data.inizio, fine: parsed.data.fine, tutto_il_giorno: parsed.data.tutto_il_giorno })
    .eq("id", id)
    .select("id");
  if (error) return { ok: false, error: dbErrorMessage(error, "Spostamento non riuscito") };
  if (data.length === 0) return NESSUN_PERMESSO;
  revalida();
  return { ok: true };
}

export async function deleteEvento(id: string): Promise<ActionResult> {
  if (!idSchema.safeParse(id).success) return NESSUN_PERMESSO;
  const supabase = await createClient();
  const { data, error } = await supabase.from("eventi").delete().eq("id", id).select("id");
  if (error) return { ok: false, error: dbErrorMessage(error, "Eliminazione non riuscita") };
  if (data.length === 0) return NESSUN_PERMESSO;
  revalida();
  return { ok: true };
}
