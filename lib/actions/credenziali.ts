"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { credenzialeSchema, parametriCassaforteSchema } from "@/lib/schemas/servizi";
import { createClient } from "@/lib/supabase/server";

import { dbErrorMessage, zodFieldErrors, type ActionResult } from "./types";

// Qui arrivano solo dati già cifrati nel browser: il server non vede mai
// né la master password né le password in chiaro.

const idSchema = z.uuid();
const proprietarioSchema = z.union([
  z.object({ servizio_id: z.uuid(), cliente_id: z.undefined().optional() }),
  z.object({ cliente_id: z.uuid(), servizio_id: z.undefined().optional() }),
]);

function revalida() {
  revalidatePath("/servizi");
  revalidatePath("/clienti", "layout");
}

export async function saveCredenziale(
  proprietario: unknown,
  input: unknown,
  credenzialeId?: string,
): Promise<ActionResult> {
  const owner = proprietarioSchema.safeParse(proprietario);
  if (!owner.success || (credenzialeId && !idSchema.safeParse(credenzialeId).success)) {
    return { ok: false, error: "Richiesta non valida" };
  }
  const parsed = credenzialeSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Controlla i campi evidenziati", fieldErrors: zodFieldErrors(parsed.error.issues) };
  }
  const v = parsed.data;
  const row =
    v.tipo === "link_password_manager"
      ? { etichetta: v.etichetta, tipo: v.tipo, url_password_manager: v.url_password_manager, payload_cifrato: null, iv: null, salt: null }
      : { etichetta: v.etichetta, tipo: v.tipo, url_password_manager: null, payload_cifrato: v.payload_cifrato, iv: v.iv, salt: v.salt };

  const supabase = await createClient();
  if (credenzialeId) {
    const { data, error } = await supabase.from("credenziali").update(row).eq("id", credenzialeId).select("id");
    if (error) return { ok: false, error: dbErrorMessage(error) };
    if (data.length === 0) return { ok: false, error: "Non hai i permessi per modificare le credenziali" };
  } else {
    const { error } = await supabase.from("credenziali").insert({
      ...row,
      servizio_id: owner.data.servizio_id ?? null,
      cliente_id: owner.data.cliente_id ?? null,
    });
    if (error) {
      return { ok: false, error: error.code === "42501" ? "Non hai i permessi per salvare credenziali" : dbErrorMessage(error) };
    }
  }
  revalida();
  return { ok: true };
}

export async function deleteCredenziale(id: string): Promise<ActionResult> {
  if (!idSchema.safeParse(id).success) return { ok: false, error: "Richiesta non valida" };
  const supabase = await createClient();
  const { data, error } = await supabase.from("credenziali").delete().eq("id", id).select("id");
  if (error) return { ok: false, error: dbErrorMessage(error) };
  if (data.length === 0) return { ok: false, error: "Non hai i permessi per eliminare questa credenziale" };
  revalida();
  return { ok: true };
}

export async function creaCassaforte(parametri: unknown): Promise<ActionResult> {
  const parsed = parametriCassaforteSchema.safeParse(parametri);
  if (!parsed.success) return { ok: false, error: "Parametri della cassaforte non validi" };
  const supabase = await createClient();
  const { error } = await supabase.from("cassaforte").insert(parsed.data);
  if (error) {
    if (error.code === "23505") return { ok: false, error: "La cassaforte è già configurata" };
    if (error.code === "42501") return { ok: false, error: "Solo l'owner può configurare la cassaforte" };
    return { ok: false, error: dbErrorMessage(error) };
  }
  revalidatePath("/impostazioni");
  return { ok: true };
}

const ricifrataSchema = z.array(
  z.object({
    id: z.uuid(),
    payload_cifrato: z.string().min(16).max(20000),
    iv: z.string().regex(/^[A-Za-z0-9+/]{16}$/),
    salt: z.string().regex(/^[A-Za-z0-9+/]{22}==$/),
  }),
);

export async function cambiaMasterPassword(parametri: unknown, credenziali: unknown): Promise<ActionResult> {
  const p = parametriCassaforteSchema.safeParse(parametri);
  const c = ricifrataSchema.safeParse(credenziali);
  if (!p.success || !c.success) return { ok: false, error: "Dati non validi" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("cambia_cassaforte", { p_parametri: p.data, p_credenziali: c.data });
  if (error) {
    return { ok: false, error: error.message.includes("nel frattempo") ? "Le credenziali sono cambiate nel frattempo: riprova" : "Cambio della master password non riuscito" };
  }
  revalidatePath("/impostazioni");
  return { ok: true };
}
