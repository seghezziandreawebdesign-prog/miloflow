"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { parseImporto } from "@/lib/servizi";
import { rinnovoSchema, servizioSchema, servizioToRpc } from "@/lib/schemas/servizi";
import { createClient } from "@/lib/supabase/server";

import { dbErrorMessage, NESSUN_PERMESSO, sqlNull, zodFieldErrors, type ActionResult } from "./types";

const idSchema = z.uuid();

function revalida() {
  revalidatePath("/servizi");
  revalidatePath("/clienti", "layout");
}

export async function saveServizio(id: string | null, input: unknown): Promise<ActionResult<{ id: string }>> {
  if (id !== null && !idSchema.safeParse(id).success) return NESSUN_PERMESSO;
  const parsed = servizioSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Controlla i campi evidenziati", fieldErrors: zodFieldErrors(parsed.error.issues) };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("salva_servizio", { p_id: sqlNull(id), ...servizioToRpc(parsed.data) });
  if (error) {
    if (error.code === "42501") return { ok: false, error: "Non hai i permessi per salvare questo servizio" };
    return { ok: false, error: dbErrorMessage(error, "Salvataggio non riuscito") };
  }
  revalida();
  return { ok: true, data: { id: data } };
}

export async function rinnovaServizio(id: string, input: unknown): Promise<ActionResult<{ scadenza: string }>> {
  if (!idSchema.safeParse(id).success) return NESSUN_PERMESSO;
  const parsed = rinnovoSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Controlla i campi evidenziati", fieldErrors: zodFieldErrors(parsed.error.issues) };
  }
  const supabase = await createClient();
  const importo = parseImporto(parsed.data.importo);
  const { data, error } = await supabase.rpc("rinnova_servizio", {
    p_servizio_id: id,
    p_data: parsed.data.data,
    p_importo: sqlNull(Number.isNaN(importo) ? null : importo),
  });
  if (error) {
    const msg = error.message.includes("una tantum") ? "Un servizio una tantum non si rinnova" : "Rinnovo non riuscito";
    return { ok: false, error: msg };
  }
  revalida();
  return { ok: true, data: { scadenza: data } };
}

const statoSchema = z.enum(["attivo", "disdetto", "archiviato"]);

export async function setStatoServizio(id: string, stato: string): Promise<ActionResult> {
  const parsedStato = statoSchema.safeParse(stato);
  if (!idSchema.safeParse(id).success || !parsedStato.success) return NESSUN_PERMESSO;
  const supabase = await createClient();
  const { data, error } = await supabase.from("servizi").update({ stato: parsedStato.data }).eq("id", id).select("id");
  if (error) return { ok: false, error: dbErrorMessage(error) };
  if (data.length === 0) return NESSUN_PERMESSO;
  revalida();
  return { ok: true };
}

/** Copia dati, costi e clienti collegati. Credenziali e storico non si copiano. */
export async function duplicaServizio(id: string): Promise<ActionResult<{ id: string }>> {
  if (!idSchema.safeParse(id).success) return NESSUN_PERMESSO;
  const supabase = await createClient();
  const [servizio, economico, clienti, prezzi] = await Promise.all([
    supabase.from("servizi").select("*").eq("id", id).maybeSingle(),
    supabase.from("servizi_economico").select("*").eq("servizio_id", id).maybeSingle(),
    supabase.from("servizi_clienti").select("cliente_id").eq("servizio_id", id),
    supabase.from("servizi_clienti_economico").select("cliente_id, prezzo_rivendita").eq("servizio_id", id),
  ]);
  if (!servizio.data) return NESSUN_PERMESSO;
  const s = servizio.data;
  const prezzo = new Map((prezzi.data ?? []).map((p) => [p.cliente_id, p.prezzo_rivendita]));

  const { data, error } = await supabase.rpc("salva_servizio", {
    p_id: sqlNull<string>(null),
    p_servizio: {
      ambito: s.ambito,
      nome: `${s.nome} (copia)`,
      tipo_id: s.tipo_id ?? "",
      fornitore: s.fornitore ?? "",
      frequenza: s.frequenza,
      prossima_scadenza: s.prossima_scadenza,
      rinnovo_automatico: s.rinnovo_automatico,
      chi_paga: s.chi_paga,
      preavviso_giorni: s.preavviso_giorni === null ? "" : String(s.preavviso_giorni),
      url_pannello: s.url_pannello ?? "",
      username: s.username ?? "",
      stato: "attivo",
      note: s.note ?? "",
    },
    p_economico: sqlNull(economico.data
      ? {
          costo: economico.data.costo === null ? "" : String(economico.data.costo),
          valuta: economico.data.valuta,
          metodo_pagamento_id: economico.data.metodo_pagamento_id ?? "",
        }
      : null),
    p_clienti: (clienti.data ?? []).map((c) => ({
      cliente_id: c.cliente_id,
      prezzo_rivendita: prezzo.get(c.cliente_id)?.toString() ?? "",
    })),
  });
  if (error) return { ok: false, error: dbErrorMessage(error, "Duplicazione non riuscita") };
  revalida();
  return { ok: true, data: { id: data } };
}

export async function deleteServizio(id: string): Promise<ActionResult> {
  if (!idSchema.safeParse(id).success) return NESSUN_PERMESSO;
  const supabase = await createClient();
  const { data, error } = await supabase.from("servizi").delete().eq("id", id).select("id");
  if (error) return { ok: false, error: dbErrorMessage(error, "Eliminazione non riuscita") };
  if (data.length === 0) return NESSUN_PERMESSO;
  revalida();
  return { ok: true };
}
