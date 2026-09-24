"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { metodoPagamentoSchema } from "@/lib/schemas/servizi";
import { createClient } from "@/lib/supabase/server";

import { dbErrorMessage, NESSUN_PERMESSO, zodFieldErrors, type ActionResult } from "./types";

const idSchema = z.uuid();

function revalida() {
  revalidatePath("/impostazioni");
  revalidatePath("/servizi");
}

export async function saveMetodoPagamento(id: string | null, input: unknown): Promise<ActionResult> {
  if (id !== null && !idSchema.safeParse(id).success) return NESSUN_PERMESSO;
  const parsed = metodoPagamentoSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Controlla i campi evidenziati", fieldErrors: zodFieldErrors(parsed.error.issues) };
  }
  const v = parsed.data;
  const row = {
    nome: v.nome,
    tipo: v.tipo,
    // Le ultime cifre hanno senso solo per le carte.
    ultime_cifre: v.tipo.startsWith("carta") || v.tipo === "prepagata" ? v.ultime_cifre || null : null,
    ambito: v.ambito,
    colore: v.colore || null,
  };
  const supabase = await createClient();
  if (id) {
    const { data, error } = await supabase.from("metodi_pagamento").update(row).eq("id", id).select("id");
    if (error) return { ok: false, error: dbErrorMessage(error) };
    if (data.length === 0) return NESSUN_PERMESSO;
  } else {
    const { error } = await supabase.from("metodi_pagamento").insert(row);
    if (error) {
      return { ok: false, error: error.code === "42501" ? "Non hai i permessi per aggiungere metodi di pagamento" : dbErrorMessage(error) };
    }
  }
  revalida();
  return { ok: true };
}

export async function setMetodoArchiviato(id: string, archiviato: boolean): Promise<ActionResult> {
  if (!idSchema.safeParse(id).success) return NESSUN_PERMESSO;
  const supabase = await createClient();
  const { data, error } = await supabase.from("metodi_pagamento").update({ archiviato }).eq("id", id).select("id");
  if (error) return { ok: false, error: dbErrorMessage(error) };
  if (data.length === 0) return NESSUN_PERMESSO;
  revalida();
  return { ok: true };
}

/** Elimina solo se nessun servizio o movimento lo usa: altrimenti va archiviato. */
export async function deleteMetodoPagamento(id: string): Promise<ActionResult> {
  if (!idSchema.safeParse(id).success) return NESSUN_PERMESSO;
  const supabase = await createClient();
  const [servizi, movimenti] = await Promise.all([
    supabase.from("servizi_economico").select("servizio_id", { count: "exact", head: true }).eq("metodo_pagamento_id", id),
    supabase.from("movimenti").select("id", { count: "exact", head: true }).eq("metodo_pagamento_id", id),
  ]);
  if ((servizi.count ?? 0) + (movimenti.count ?? 0) > 0) {
    return { ok: false, error: "È già usato da servizi o spese: archivialo, così lo storico resta intatto" };
  }
  const { data, error } = await supabase.from("metodi_pagamento").delete().eq("id", id).select("id");
  if (error) return { ok: false, error: dbErrorMessage(error) };
  if (data.length === 0) return NESSUN_PERMESSO;
  revalida();
  return { ok: true };
}
