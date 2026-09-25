"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { contrattoSchema, contrattoToRpc } from "@/lib/schemas/contratti";
import { createClient } from "@/lib/supabase/server";

import { dbErrorMessage, NESSUN_PERMESSO, sqlNull, zodFieldErrors, type ActionResult } from "./types";

const idSchema = z.uuid();

function revalida() {
  revalidatePath("/contratti");
  revalidatePath("/clienti", "layout");
}

export async function saveContratto(id: string | null, input: unknown): Promise<ActionResult<{ id: string }>> {
  if (id !== null && !idSchema.safeParse(id).success) return NESSUN_PERMESSO;
  const parsed = contrattoSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Controlla i campi evidenziati", fieldErrors: zodFieldErrors(parsed.error.issues) };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("salva_contratto", { p_id: sqlNull(id), ...contrattoToRpc(parsed.data) });
  if (error) {
    if (error.code === "42501") return { ok: false, error: "Non hai i permessi per salvare questo contratto" };
    return { ok: false, error: dbErrorMessage(error, "Salvataggio non riuscito") };
  }
  revalida();
  return { ok: true, data: { id: data } };
}

const statoSchema = z.enum(["attivo", "concluso"]);

export async function setStatoContratto(id: string, stato: string): Promise<ActionResult> {
  const parsedId = idSchema.safeParse(id);
  const parsedStato = statoSchema.safeParse(stato);
  if (!parsedId.success || !parsedStato.success) return NESSUN_PERMESSO;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contratti")
    .update({ stato: parsedStato.data })
    .eq("id", parsedId.data)
    .select("id");
  if (error) return { ok: false, error: dbErrorMessage(error) };
  if (!data || data.length === 0) return NESSUN_PERMESSO;
  revalida();
  return { ok: true };
}

export async function deleteContratto(id: string): Promise<ActionResult> {
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) return NESSUN_PERMESSO;
  const supabase = await createClient();
  const { data, error } = await supabase.from("contratti").delete().eq("id", parsed.data).select("id");
  if (error) return { ok: false, error: dbErrorMessage(error, "Eliminazione non riuscita") };
  if (!data || data.length === 0) return NESSUN_PERMESSO;
  revalida();
  return { ok: true };
}
