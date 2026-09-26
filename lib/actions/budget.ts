"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { aggiungiMesi, primoDelMese } from "@/lib/budget";
import { todayISO } from "@/lib/dates/format";
import {
  budgetMeseSchema,
  categoriaSchema,
  categoriaToDb,
  debitoSchema,
  debitoToRpc,
  movimentoSchema,
  movimentoToDb,
  pagamentoSchema,
  pagamentoToRpc,
} from "@/lib/schemas/budget";
import { parseImporto } from "@/lib/servizi";
import { createClient } from "@/lib/supabase/server";

import { dbErrorMessage, NESSUN_PERMESSO, sqlNull, zodFieldErrors, type ActionResult } from "./types";

const idSchema = z.uuid();
const dataSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

function revalida() {
  revalidatePath("/budget");
  revalidatePath("/oggi");
  revalidatePath("/calendario");
  revalidatePath("/servizi");
}

function messaggioRpc(error: { code?: string; message: string }, fallback: string): string {
  // Le eccezioni sollevate dalle funzioni SQL hanno un messaggio già leggibile.
  if (error.code === "P0001") return error.message;
  return dbErrorMessage(error, fallback);
}

// ---------------------------------------------------------------------------
// Movimenti
// ---------------------------------------------------------------------------

export async function saveMovimento(id: string | null, input: unknown): Promise<ActionResult<{ id: string }>> {
  if (id !== null && !idSchema.safeParse(id).success) return NESSUN_PERMESSO;
  const parsed = movimentoSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Controlla i campi evidenziati", fieldErrors: zodFieldErrors(parsed.error.issues) };
  }
  const supabase = await createClient();
  const valori = movimentoToDb(parsed.data);
  if (id === null) {
    const nuovo = crypto.randomUUID();
    const { error } = await supabase.from("movimenti").insert({ id: nuovo, ...valori, periodo: primoDelMese(valori.data) });
    if (error) return { ok: false, error: dbErrorMessage(error, "Salvataggio non riuscito") };
    revalida();
    return { ok: true, data: { id: nuovo } };
  }
  // Un previsto generato (servizio o rata) mantiene il collegamento: qui si
  // cambiano solo i campi liberi.
  const { data, error } = await supabase.from("movimenti").update(valori).eq("id", id).select("id");
  if (error) return { ok: false, error: dbErrorMessage(error, "Salvataggio non riuscito") };
  if (data.length === 0) return NESSUN_PERMESSO;
  revalida();
  return { ok: true, data: { id } };
}

export async function deleteMovimento(id: string): Promise<ActionResult> {
  if (!idSchema.safeParse(id).success) return NESSUN_PERMESSO;
  const supabase = await createClient();
  const { data: mov } = await supabase.from("movimenti").select("rata_id, stato").eq("id", id).maybeSingle();
  if (!mov) return NESSUN_PERMESSO;
  if (mov.rata_id && mov.stato === "pagato") {
    return { ok: false, error: "È il pagamento di una rata: annulla il pagamento dal debito" };
  }
  const { data, error } = await supabase.from("movimenti").delete().eq("id", id).select("id");
  if (error) return { ok: false, error: dbErrorMessage(error, "Eliminazione non riuscita") };
  if (data.length === 0) return NESSUN_PERMESSO;
  revalida();
  return { ok: true };
}

/** "Segna pagato" di un previsto (importo modificabile). Le rate passano da paga_rata. */
export async function segnaPagato(id: string, input: unknown): Promise<ActionResult> {
  if (!idSchema.safeParse(id).success) return NESSUN_PERMESSO;
  const parsed = pagamentoSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Controlla i campi evidenziati", fieldErrors: zodFieldErrors(parsed.error.issues) };
  }
  const supabase = await createClient();
  const { data: mov } = await supabase.from("movimenti").select("rata_id, importo").eq("id", id).maybeSingle();
  if (!mov) return NESSUN_PERMESSO;
  const v = pagamentoToRpc(parsed.data);
  if (mov.rata_id) return pagaRata(mov.rata_id, input);
  const { data, error } = await supabase
    .from("movimenti")
    .update({
      stato: "pagato",
      data: v.data,
      importo: v.importo ?? mov.importo,
      metodo_pagamento_id: v.metodo_pagamento_id,
    })
    .eq("id", id)
    .select("id");
  if (error) return { ok: false, error: dbErrorMessage(error, "Operazione non riuscita") };
  if (data.length === 0) return NESSUN_PERMESSO;
  revalida();
  return { ok: true };
}

/** Riporta un movimento pagato a previsto (per una rata annulla il pagamento). */
export async function segnaPrevisto(id: string): Promise<ActionResult> {
  if (!idSchema.safeParse(id).success) return NESSUN_PERMESSO;
  const supabase = await createClient();
  const { data: mov } = await supabase.from("movimenti").select("rata_id").eq("id", id).maybeSingle();
  if (!mov) return NESSUN_PERMESSO;
  if (mov.rata_id) return annullaPagamentoRata(mov.rata_id);
  const { data, error } = await supabase.from("movimenti").update({ stato: "previsto" }).eq("id", id).select("id");
  if (error) return { ok: false, error: dbErrorMessage(error, "Operazione non riuscita") };
  if (data.length === 0) return NESSUN_PERMESSO;
  revalida();
  return { ok: true };
}

/** Collega o scollega la ricevuta già caricata nello Storage. */
export async function setRicevuta(id: string, path: string | null): Promise<ActionResult> {
  if (!idSchema.safeParse(id).success) return NESSUN_PERMESSO;
  if (path !== null && !path.startsWith(`${id}/`)) return { ok: false, error: "Percorso della ricevuta non valido" };
  const supabase = await createClient();
  const { data, error } = await supabase.from("movimenti").update({ ricevuta_path: path }).eq("id", id).select("id");
  if (error) return { ok: false, error: dbErrorMessage(error, "Operazione non riuscita") };
  if (data.length === 0) return NESSUN_PERMESSO;
  revalida();
  return { ok: true };
}

/**
 * "Aggiorna previsti": tutti i mesi, dal mese guardato (o da quello corrente,
 * se è precedente) fino a un anno dopo oggi. La funzione è idempotente, quindi
 * ripeterla non crea duplicati.
 */
export async function aggiornaPrevisti(mese: string): Promise<ActionResult<{ righe: number }>> {
  if (!dataSchema.safeParse(mese).success) return NESSUN_PERMESSO;
  const supabase = await createClient();
  const corrente = primoDelMese(todayISO());
  const da = primoDelMese(mese) < corrente ? primoDelMese(mese) : corrente;
  const fine = aggiungiMesi(corrente, 12);
  let righe = 0;
  for (let m = da; m <= fine; m = aggiungiMesi(m, 1)) {
    const { data, error } = await supabase.rpc("genera_previsti", { p_mese: m });
    if (error) return { ok: false, error: messaggioRpc(error, "Aggiornamento non riuscito") };
    righe += data ?? 0;
  }
  revalida();
  return { ok: true, data: { righe } };
}

// ---------------------------------------------------------------------------
// Budget del mese
// ---------------------------------------------------------------------------

export async function saveBudgetMese(input: unknown): Promise<ActionResult> {
  const parsed = budgetMeseSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Controlla i campi evidenziati", fieldErrors: zodFieldErrors(parsed.error.issues) };
  }
  const supabase = await createClient();
  const importo = parseImporto(parsed.data.importo);
  const { categoria_id, mese } = parsed.data;
  const { error } =
    importo === null
      ? await supabase.from("budget_mensili").delete().eq("categoria_id", categoria_id).eq("mese", mese)
      : await supabase.from("budget_mensili").upsert({ categoria_id, mese, importo }, { onConflict: "categoria_id,mese" });
  if (error) return { ok: false, error: dbErrorMessage(error, "Salvataggio non riuscito") };
  revalida();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Categorie
// ---------------------------------------------------------------------------

export async function saveCategoria(id: string | null, input: unknown): Promise<ActionResult<{ id: string }>> {
  if (id !== null && !idSchema.safeParse(id).success) return NESSUN_PERMESSO;
  const parsed = categoriaSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Controlla i campi evidenziati", fieldErrors: zodFieldErrors(parsed.error.issues) };
  }
  if (id !== null && parsed.data.parent_id === id) return { ok: false, error: "Una categoria non può stare dentro sé stessa" };
  const supabase = await createClient();
  const valori = categoriaToDb(parsed.data);
  if (id === null) {
    const nuovo = crypto.randomUUID();
    // In fondo al suo livello.
    const livello = supabase.from("categorie").select("ordine");
    const { data: ultima } = await (valori.parent_id === null ? livello.is("parent_id", null) : livello.eq("parent_id", valori.parent_id))
      .order("ordine", { ascending: false })
      .limit(1);
    const { error } = await supabase.from("categorie").insert({ id: nuovo, ...valori, ordine: (ultima?.[0]?.ordine ?? 0) + 10 });
    if (error) return { ok: false, error: messaggioRpc(error, "Salvataggio non riuscito") };
    revalidatePath("/impostazioni");
    revalida();
    return { ok: true, data: { id: nuovo } };
  }
  const { data, error } = await supabase.from("categorie").update(valori).eq("id", id).select("id");
  if (error) return { ok: false, error: messaggioRpc(error, "Salvataggio non riuscito") };
  if (data.length === 0) return NESSUN_PERMESSO;
  revalidatePath("/impostazioni");
  revalida();
  return { ok: true, data: { id } };
}

export async function setCategoriaArchiviata(id: string, archiviata: boolean): Promise<ActionResult> {
  if (!idSchema.safeParse(id).success) return NESSUN_PERMESSO;
  const supabase = await createClient();
  // Archiviando un padre si archiviano anche le figlie.
  const { data, error } = await supabase
    .from("categorie")
    .update({ archiviata })
    .or(`id.eq.${id},parent_id.eq.${id}`)
    .select("id");
  if (error) return { ok: false, error: dbErrorMessage(error) };
  if (data.length === 0) return NESSUN_PERMESSO;
  revalidatePath("/impostazioni");
  revalida();
  return { ok: true };
}

export async function riordinaCategorie(parentId: string | null, ids: string[]): Promise<ActionResult> {
  if ((parentId !== null && !idSchema.safeParse(parentId).success) || !z.array(idSchema).max(500).safeParse(ids).success) {
    return NESSUN_PERMESSO;
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("riordina_categorie", { p_parent_id: sqlNull(parentId), p_ids: ids });
  if (error) return { ok: false, error: messaggioRpc(error, "Riordino non riuscito") };
  revalidatePath("/impostazioni");
  revalida();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Debiti e rate
// ---------------------------------------------------------------------------

export async function saveDebito(id: string | null, input: unknown): Promise<ActionResult<{ id: string }>> {
  if (id !== null && !idSchema.safeParse(id).success) return NESSUN_PERMESSO;
  const parsed = debitoSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Controlla i campi evidenziati", fieldErrors: zodFieldErrors(parsed.error.issues) };
  }
  const supabase = await createClient();
  const args = debitoToRpc(parsed.data);
  const { data, error } = await supabase.rpc("salva_debito", { p_id: sqlNull(id), p_debito: args.p_debito, p_rate: args.p_rate });
  if (error) return { ok: false, error: messaggioRpc(error, "Salvataggio non riuscito") };
  revalida();
  return { ok: true, data: { id: data } };
}

export async function deleteDebito(id: string): Promise<ActionResult> {
  if (!idSchema.safeParse(id).success) return NESSUN_PERMESSO;
  const supabase = await createClient();
  const { error } = await supabase.rpc("elimina_debito", { p_id: id });
  if (error) return { ok: false, error: messaggioRpc(error, "Eliminazione non riuscita") };
  revalida();
  return { ok: true };
}

export async function pagaRata(rataId: string, input: unknown): Promise<ActionResult> {
  if (!idSchema.safeParse(rataId).success) return NESSUN_PERMESSO;
  const parsed = pagamentoSchema.safeParse(input ?? { data: todayISO(), importo: "", metodo_pagamento_id: "" });
  if (!parsed.success) {
    return { ok: false, error: "Controlla i campi evidenziati", fieldErrors: zodFieldErrors(parsed.error.issues) };
  }
  const v = pagamentoToRpc(parsed.data);
  const supabase = await createClient();
  const { error } = await supabase.rpc("paga_rata", {
    p_rata_id: rataId,
    p_data: v.data,
    p_importo: sqlNull(v.importo),
    p_metodo_id: sqlNull(v.metodo_pagamento_id),
  });
  if (error) return { ok: false, error: messaggioRpc(error, "Pagamento non registrato") };
  revalida();
  return { ok: true };
}

export async function annullaPagamentoRata(rataId: string): Promise<ActionResult> {
  if (!idSchema.safeParse(rataId).success) return NESSUN_PERMESSO;
  const supabase = await createClient();
  const { error } = await supabase.rpc("annulla_pagamento_rata", { p_rata_id: rataId });
  if (error) return { ok: false, error: messaggioRpc(error, "Operazione non riuscita") };
  revalida();
  return { ok: true };
}
