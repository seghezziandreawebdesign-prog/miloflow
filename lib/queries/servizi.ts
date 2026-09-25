import "server-only";

import type { FiltroAmbito } from "@/lib/ambito";
import { nomeCliente } from "@/lib/clienti";
import { caricaServizi } from "@/lib/queries/cliente-scheda";
import { createClient } from "@/lib/supabase/server";

export type { ClienteCollegato, ServizioLista } from "@/lib/queries/cliente-scheda";

/** Servizi con clienti collegati e prezzi di rivendita (se visibili). */
export async function listServizi(filtro: { ambito?: FiltroAmbito; clienteId?: string } = {}) {
  const supabase = await createClient();
  return caricaServizi(supabase, filtro);
}

export async function listTipiServizio() {
  const supabase = await createClient();
  const { data } = await supabase.from("tipi_servizio").select("id, nome, icona, preavviso_default").order("nome");
  return data ?? [];
}

export type TipoServizio = Awaited<ReturnType<typeof listTipiServizio>>[number];

/** Clienti selezionabili nei form (esclusi gli archiviati). */
export async function listClientiSelezionabili() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("clienti")
    .select("id, nome_breve, ragione_sociale, stato")
    .neq("stato", "archiviato")
    .order("ragione_sociale");
  return (data ?? []).map((c) => ({ id: c.id, nome: nomeCliente(c) }));
}

export type ClienteOpzione = Awaited<ReturnType<typeof listClientiSelezionabili>>[number];
