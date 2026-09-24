"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { numero, pagamentoSchema, pagamentoToRpc } from "@/lib/schemas/budget";
import { prelievoSchema, salvadanaioSchema, salvadanaioToDb, valoreSchema } from "@/lib/schemas/salvadanai";
import { createClient } from "@/lib/supabase/server";

import { dbErrorMessage, NESSUN_PERMESSO, zodFieldErrors, type ActionResult } from "./types";

const idSchema = z.uuid();

function revalida() {
  revalidatePath("/budget");
  revalidatePath("/oggi");
  revalidatePath("/calendario");
}

function messaggioRpc(error: { code?: string; message: string }, fallback: string): string {
  if (error.code === "P0001") return error.message;
  return dbErrorMessage(error, fallback);
}

export async function saveSalvadanaio(id: string | null, input: unknown): Promise<ActionResult<{ id: string }>> {
  if (id !== null && !idSchema.safeParse(id).success) return NESSUN_PERMESSO;
  const parsed = salvadanaioSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Controlla i campi evidenziati", fieldErrors: zodFieldErrors(parsed.error.issues) };
  }
  const supabase = await createClient();
  const valori = salvadanaioToDb(parsed.data);
  if (id === null) {
    const nuovo = crypto.randomUUID();
    const { error } = await supabase.from("salvadanai").insert({ id: nuovo, ...valori });
    if (error) return { ok: false, error: dbErrorMessage(error, "Salvataggio non riuscito") };
    revalida();
    return { ok: true, data: { id: nuovo } };
  }
  // Il tipo non cambia dopo la creazione.
  const modifica: Partial<typeof valori> = { ...valori };
  delete modifica.tipo;
  const { data, error } = await supabase.from("salvadanai").update(modifica).eq("id", id).select("id");
  if (error) return { ok: false, error: dbErrorMessage(error, "Salvataggio non riuscito") };
  if (data.length === 0) return NESSUN_PERMESSO;
  revalida();
  return { ok: true, data: { id } };
}

export async function setSalvadanaioArchiviato(id: string, archiviato: boolean): Promise<ActionResult> {
  if (!idSchema.safeParse(id).success) return NESSUN_PERMESSO;
  const supabase = await createClient();
  const { data, error } = await supabase.from("salvadanai").update({ archiviato }).eq("id", id).select("id");
  if (error) return { ok: false, error: dbErrorMessage(error) };
  if (data.length === 0) return NESSUN_PERMESSO;
  revalida();
  return { ok: true };
}

/** Solo senza versamenti né prelievi (lo controlla elimina_salvadanaio). */
export async function deleteSalvadanaio(id: string): Promise<ActionResult> {
  if (!idSchema.safeParse(id).success) return NESSUN_PERMESSO;
  const supabase = await createClient();
  const { error } = await supabase.rpc("elimina_salvadanaio", { p_id: id });
  if (error) return { ok: false, error: messaggioRpc(error, "Eliminazione non riuscita") };
  revalida();
  return { ok: true };
}

/**
 * Versamento fatto a mano: un movimento pagato nella categoria del
 * salvadanaio, senza periodo (non collide con il previsto del piano).
 */
export async function versaSalvadanaio(id: string, input: unknown): Promise<ActionResult<{ id: string }>> {
  if (!idSchema.safeParse(id).success) return NESSUN_PERMESSO;
  const parsed = pagamentoSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Controlla i campi evidenziati", fieldErrors: zodFieldErrors(parsed.error.issues) };
  }
  const v = pagamentoToRpc(parsed.data);
  if (!v.importo || v.importo <= 0) return { ok: false, error: "Inserisci un importo", fieldErrors: { importo: "Inserisci un importo" } };
  const supabase = await createClient();
  const { data: s } = await supabase
    .from("salvadanai")
    .select("ambito, nome, categoria_id, metodo_pagamento_id")
    .eq("id", id)
    .maybeSingle();
  if (!s) return NESSUN_PERMESSO;
  const movimento = crypto.randomUUID();
  const { error } = await supabase.from("movimenti").insert({
    id: movimento,
    ambito: s.ambito,
    data: v.data,
    importo: v.importo,
    descrizione: s.nome,
    categoria_id: s.categoria_id,
    stato: "pagato",
    salvadanaio_id: id,
    metodo_pagamento_id: v.metodo_pagamento_id ?? s.metodo_pagamento_id,
  });
  if (error) return { ok: false, error: dbErrorMessage(error, "Versamento non riuscito") };
  revalida();
  return { ok: true, data: { id: movimento } };
}

export async function prelevaSalvadanaio(id: string, input: unknown): Promise<ActionResult> {
  if (!idSchema.safeParse(id).success) return NESSUN_PERMESSO;
  const parsed = prelievoSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Controlla i campi evidenziati", fieldErrors: zodFieldErrors(parsed.error.issues) };
  }
  const supabase = await createClient();
  const { error } = await supabase.from("salvadanai_prelievi").insert({
    salvadanaio_id: id,
    data: parsed.data.data,
    importo: numero(parsed.data.importo) ?? 0,
    note: parsed.data.note || null,
  });
  if (error) return { ok: false, error: dbErrorMessage(error, "Prelievo non riuscito") };
  revalida();
  return { ok: true };
}

export async function deletePrelievo(id: string): Promise<ActionResult> {
  if (!idSchema.safeParse(id).success) return NESSUN_PERMESSO;
  const supabase = await createClient();
  const { data, error } = await supabase.from("salvadanai_prelievi").delete().eq("id", id).select("id");
  if (error) return { ok: false, error: dbErrorMessage(error, "Eliminazione non riuscita") };
  if (data.length === 0) return NESSUN_PERMESSO;
  revalida();
  return { ok: true };
}

/** Valore dell'investimento a una data: uno per giorno, lo stesso giorno si sovrascrive. */
export async function saveValore(salvadanaioId: string, input: unknown): Promise<ActionResult> {
  if (!idSchema.safeParse(salvadanaioId).success) return NESSUN_PERMESSO;
  const parsed = valoreSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Controlla i campi evidenziati", fieldErrors: zodFieldErrors(parsed.error.issues) };
  }
  const supabase = await createClient();
  const { error } = await supabase.from("salvadanai_valori").upsert(
    {
      salvadanaio_id: salvadanaioId,
      data: parsed.data.data,
      valore: numero(parsed.data.importo) ?? 0,
      note: parsed.data.note || null,
    },
    { onConflict: "salvadanaio_id,data" },
  );
  if (error) return { ok: false, error: dbErrorMessage(error, "Salvataggio non riuscito") };
  revalida();
  return { ok: true };
}

export async function deleteValore(id: string): Promise<ActionResult> {
  if (!idSchema.safeParse(id).success) return NESSUN_PERMESSO;
  const supabase = await createClient();
  const { data, error } = await supabase.from("salvadanai_valori").delete().eq("id", id).select("id");
  if (error) return { ok: false, error: dbErrorMessage(error, "Eliminazione non riuscita") };
  if (data.length === 0) return NESSUN_PERMESSO;
  revalida();
  return { ok: true };
}
