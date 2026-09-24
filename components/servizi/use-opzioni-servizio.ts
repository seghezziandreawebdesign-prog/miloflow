"use client";

import { useQuery } from "@tanstack/react-query";

import { nomeCliente } from "@/lib/clienti";
import { createClient } from "@/lib/supabase/client";

export type OpzioniServizio = {
  tipi: { id: string; nome: string; icona: string | null; preavviso_default: number }[];
  clienti: { id: string; nome: string }[];
  /** Può vedere e scrivere costi e prezzi (owner o permesso budget in scrittura). */
  puoBudget: boolean;
};

async function carica(): Promise<OpzioniServizio> {
  const supabase = createClient();
  const [tipi, clienti, budget] = await Promise.all([
    supabase.from("tipi_servizio").select("id, nome, icona, preavviso_default").order("nome"),
    supabase.from("clienti").select("id, nome_breve, ragione_sociale").neq("stato", "archiviato").order("ragione_sociale"),
    supabase.rpc("puo", { p_sezione: "budget", p_livello: "scrittura" }),
  ]);
  return {
    tipi: tipi.data ?? [],
    clienti: (clienti.data ?? []).map((c) => ({ id: c.id, nome: nomeCliente(c) })),
    puoBudget: budget.data === true,
  };
}

/** Tipi di servizio e clienti selezionabili, per il form del servizio ovunque si apra. */
export function useOpzioniServizio(enabled = true) {
  return useQuery({ queryKey: ["opzioni-servizio"], queryFn: carica, enabled, staleTime: 60_000 });
}
