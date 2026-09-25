"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { nomeCliente, normalizeUrl, PALETTE_CLIENTI } from "@/lib/clienti";
import {
  clienteSchema,
  clienteToRow,
  contattoSchema,
  linkSchema,
  notaDiarioSchema,
} from "@/lib/schemas/clienti";
import { createClient } from "@/lib/supabase/server";

import { dbErrorMessage, zodFieldErrors, type ActionResult } from "./types";

const idSchema = z.uuid();
const statoSchema = z.enum(["attivo", "potenziale", "in_pausa", "archiviato"]);

function revalidaCliente(id?: string) {
  revalidatePath("/clienti");
  if (id) revalidatePath(`/clienti/${id}`);
}

const NESSUN_PERMESSO: ActionResult = { ok: false, error: "Elemento non trovato o permessi insufficienti" };

// ---------- Cliente ----------

export async function createCliente(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = clienteSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Controlla i campi evidenziati", fieldErrors: zodFieldErrors(parsed.error.issues) };
  }
  const supabase = await createClient();
  // Un colore c'è sempre: se non è stato scelto, uno a caso della palette
  // (lo usano il logo con le iniziali e il progetto creato qui sotto).
  const riga = clienteToRow(parsed.data);
  riga.colore ??= PALETTE_CLIENTI[Math.floor(Math.random() * PALETTE_CLIENTI.length)];
  const { data, error } = await supabase.from("clienti").insert(riga).select("id").single();
  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: "Esiste già un cliente con questa P.IVA", fieldErrors: { piva: "P.IVA già presente" } };
    }
    if (error.code === "42501") return { ok: false, error: "Solo l'owner può creare nuovi clienti" };
    return { ok: false, error: dbErrorMessage(error, "Salvataggio non riuscito") };
  }
  // Ogni cliente nasce col suo progetto: stesso nome, stesso colore, in fondo
  // alla lista. Se non riesce, il cliente resta comunque creato.
  const { data: ultimo } = await supabase.from("progetti").select("ordine").order("ordine", { ascending: false }).limit(1);
  const { error: erroreProgetto } = await supabase.from("progetti").insert({
    nome: nomeCliente(parsed.data),
    ambito: "lavoro",
    cliente_id: data.id,
    colore: riga.colore,
    ordine: (ultimo?.[0]?.ordine ?? 0) + 10,
  });
  if (erroreProgetto) {
    revalidaCliente();
    return { ok: false, error: "Cliente creato, ma non sono riuscito a creare il suo progetto" };
  }
  revalidaCliente();
  revalidatePath("/task", "layout");
  return { ok: true, data: { id: data.id } };
}

export async function updateCliente(id: string, input: unknown): Promise<ActionResult> {
  if (!idSchema.safeParse(id).success) return NESSUN_PERMESSO;
  const parsed = clienteSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Controlla i campi evidenziati", fieldErrors: zodFieldErrors(parsed.error.issues) };
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clienti")
    .update(clienteToRow(parsed.data))
    .eq("id", id)
    .select("id");
  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: "Esiste già un cliente con questa P.IVA", fieldErrors: { piva: "P.IVA già presente" } };
    }
    return { ok: false, error: dbErrorMessage(error, "Salvataggio non riuscito") };
  }
  if (data.length === 0) return NESSUN_PERMESSO;
  revalidaCliente(id);
  return { ok: true };
}

export async function setStatoCliente(id: string, stato: string): Promise<ActionResult> {
  const parsedStato = statoSchema.safeParse(stato);
  if (!idSchema.safeParse(id).success || !parsedStato.success) return NESSUN_PERMESSO;
  const supabase = await createClient();
  const { data, error } = await supabase.from("clienti").update({ stato: parsedStato.data }).eq("id", id).select("id");
  if (error) return { ok: false, error: dbErrorMessage(error) };
  if (data.length === 0) return NESSUN_PERMESSO;
  revalidaCliente(id);
  return { ok: true };
}

export async function deleteCliente(id: string): Promise<ActionResult> {
  if (!idSchema.safeParse(id).success) return NESSUN_PERMESSO;
  const supabase = await createClient();
  const { data: cliente } = await supabase.from("clienti").select("logo_path").eq("id", id).single();
  const { data, error } = await supabase.from("clienti").delete().eq("id", id).select("id");
  if (error) return { ok: false, error: dbErrorMessage(error, "Eliminazione non riuscita") };
  if (data.length === 0) return { ok: false, error: "Solo l'owner può eliminare un cliente" };
  if (cliente?.logo_path) await supabase.storage.from("loghi").remove([cliente.logo_path]);
  revalidaCliente();
  return { ok: true };
}

/** Salva il percorso del logo appena caricato (o null per toglierlo) e cancella il vecchio file. */
export async function setLogoCliente(id: string, path: string | null): Promise<ActionResult> {
  if (!idSchema.safeParse(id).success) return NESSUN_PERMESSO;
  if (path !== null && !new RegExp(`^${id}/[\\w.-]+$`).test(path)) {
    return { ok: false, error: "Percorso del logo non valido" };
  }
  const supabase = await createClient();
  const { data: prima } = await supabase.from("clienti").select("logo_path").eq("id", id).single();
  const { data, error } = await supabase.from("clienti").update({ logo_path: path }).eq("id", id).select("id");
  if (error) return { ok: false, error: dbErrorMessage(error) };
  if (data.length === 0) return NESSUN_PERMESSO;
  if (prima?.logo_path && prima.logo_path !== path) {
    await supabase.storage.from("loghi").remove([prima.logo_path]);
  }
  revalidaCliente(id);
  return { ok: true };
}

// ---------- Contatti ----------

export async function saveContatto(
  clienteId: string,
  input: unknown,
  contattoId?: string,
): Promise<ActionResult> {
  if (!idSchema.safeParse(clienteId).success) return NESSUN_PERMESSO;
  if (contattoId && !idSchema.safeParse(contattoId).success) return NESSUN_PERMESSO;
  const parsed = contattoSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Controlla i campi evidenziati", fieldErrors: zodFieldErrors(parsed.error.issues) };
  }
  const v = parsed.data;
  const supabase = await createClient();

  // Il primo contatto di un cliente diventa principale in automatico.
  const { count } = await supabase
    .from("clienti_contatti")
    .select("id", { count: "exact", head: true })
    .eq("cliente_id", clienteId);
  const principale = v.principale || (!contattoId && count === 0);

  const row = {
    nome: v.nome,
    ruolo: v.ruolo || null,
    email: v.email.toLowerCase() || null,
    telefono: v.telefono || null,
  };
  const { data, error } = contattoId
    ? await supabase.from("clienti_contatti").update(row).eq("id", contattoId).select("id").single()
    : await supabase.from("clienti_contatti").insert({ ...row, cliente_id: clienteId }).select("id").single();
  if (error || !data) return { ok: false, error: error ? dbErrorMessage(error) : "Salvataggio non riuscito" };

  if (principale) {
    const { error: rpcError } = await supabase.rpc("imposta_contatto_principale", { p_contatto_id: data.id });
    if (rpcError) return { ok: false, error: "Contatto salvato, ma non è stato possibile renderlo principale" };
  }
  revalidaCliente(clienteId);
  return { ok: true };
}

export async function setContattoPrincipale(clienteId: string, contattoId: string): Promise<ActionResult> {
  if (!idSchema.safeParse(contattoId).success) return NESSUN_PERMESSO;
  const supabase = await createClient();
  const { error } = await supabase.rpc("imposta_contatto_principale", { p_contatto_id: contattoId });
  if (error) return { ok: false, error: "Non è stato possibile impostare il contatto principale" };
  revalidaCliente(clienteId);
  return { ok: true };
}

export async function deleteContatto(clienteId: string, contattoId: string): Promise<ActionResult> {
  if (!idSchema.safeParse(contattoId).success) return NESSUN_PERMESSO;
  const supabase = await createClient();
  const { data, error } = await supabase.from("clienti_contatti").delete().eq("id", contattoId).select("id");
  if (error) return { ok: false, error: dbErrorMessage(error) };
  if (data.length === 0) return NESSUN_PERMESSO;
  revalidaCliente(clienteId);
  return { ok: true };
}

// ---------- Link ----------

export async function saveLink(clienteId: string, input: unknown, linkId?: string): Promise<ActionResult> {
  if (!idSchema.safeParse(clienteId).success) return NESSUN_PERMESSO;
  if (linkId && !idSchema.safeParse(linkId).success) return NESSUN_PERMESSO;
  const parsed = linkSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Controlla i campi evidenziati", fieldErrors: zodFieldErrors(parsed.error.issues) };
  }
  const row = { etichetta: parsed.data.etichetta, url: normalizeUrl(parsed.data.url) ?? "" };
  const supabase = await createClient();

  if (linkId) {
    const { data, error } = await supabase.from("clienti_link").update(row).eq("id", linkId).select("id");
    if (error) return { ok: false, error: dbErrorMessage(error) };
    if (data.length === 0) return NESSUN_PERMESSO;
  } else {
    const { data: ultimo } = await supabase
      .from("clienti_link")
      .select("ordine")
      .eq("cliente_id", clienteId)
      .order("ordine", { ascending: false })
      .limit(1)
      .maybeSingle();
    const { error } = await supabase
      .from("clienti_link")
      .insert({ ...row, cliente_id: clienteId, ordine: (ultimo?.ordine ?? 0) + 1 });
    if (error) return { ok: false, error: dbErrorMessage(error) };
  }
  revalidaCliente(clienteId);
  return { ok: true };
}

export async function deleteLink(clienteId: string, linkId: string): Promise<ActionResult> {
  if (!idSchema.safeParse(linkId).success) return NESSUN_PERMESSO;
  const supabase = await createClient();
  const { data, error } = await supabase.from("clienti_link").delete().eq("id", linkId).select("id");
  if (error) return { ok: false, error: dbErrorMessage(error) };
  if (data.length === 0) return NESSUN_PERMESSO;
  revalidaCliente(clienteId);
  return { ok: true };
}

/** Sposta un link di una posizione, scambiando l'ordine con il vicino. */
export async function moveLink(clienteId: string, linkId: string, direzione: "su" | "giu"): Promise<ActionResult> {
  if (!idSchema.safeParse(clienteId).success || !idSchema.safeParse(linkId).success) return NESSUN_PERMESSO;
  const supabase = await createClient();
  const { data: links, error } = await supabase
    .from("clienti_link")
    .select("id, ordine")
    .eq("cliente_id", clienteId)
    .order("ordine")
    .order("created_at");
  if (error) return { ok: false, error: dbErrorMessage(error) };

  const index = links.findIndex((l) => l.id === linkId);
  const target = direzione === "su" ? index - 1 : index + 1;
  if (index < 0 || target < 0 || target >= links.length) return { ok: true };

  // Riassegna ordini consecutivi, così lo scambio funziona anche con ordini duplicati.
  const riordinati = links.map((l) => l.id);
  [riordinati[index], riordinati[target]] = [riordinati[target], riordinati[index]];
  for (const [ordine, id] of riordinati.entries()) {
    const { error: updError } = await supabase.from("clienti_link").update({ ordine }).eq("id", id);
    if (updError) return { ok: false, error: dbErrorMessage(updError) };
  }
  revalidaCliente(clienteId);
  return { ok: true };
}

// ---------- Diario ----------

export async function saveNotaDiario(clienteId: string, input: unknown, notaId?: string): Promise<ActionResult> {
  if (!idSchema.safeParse(clienteId).success) return NESSUN_PERMESSO;
  if (notaId && !idSchema.safeParse(notaId).success) return NESSUN_PERMESSO;
  const parsed = notaDiarioSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Controlla i campi evidenziati", fieldErrors: zodFieldErrors(parsed.error.issues) };
  }
  const supabase = await createClient();
  if (notaId) {
    const { data, error } = await supabase.from("clienti_diario").update(parsed.data).eq("id", notaId).select("id");
    if (error) return { ok: false, error: dbErrorMessage(error) };
    if (data.length === 0) return NESSUN_PERMESSO;
  } else {
    const { error } = await supabase.from("clienti_diario").insert({ ...parsed.data, cliente_id: clienteId });
    if (error) return { ok: false, error: dbErrorMessage(error) };
  }
  revalidaCliente(clienteId);
  return { ok: true };
}

export async function deleteNotaDiario(clienteId: string, notaId: string): Promise<ActionResult> {
  if (!idSchema.safeParse(notaId).success) return NESSUN_PERMESSO;
  const supabase = await createClient();
  const { data, error } = await supabase.from("clienti_diario").delete().eq("id", notaId).select("id");
  if (error) return { ok: false, error: dbErrorMessage(error) };
  if (data.length === 0) return NESSUN_PERMESSO;
  revalidaCliente(clienteId);
  return { ok: true };
}
