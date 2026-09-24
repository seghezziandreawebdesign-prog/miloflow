"use client";

import { useQuery } from "@tanstack/react-query";

import type { Categoria } from "@/lib/budget";
import { nomeCliente } from "@/lib/clienti";
import type { TipoMetodo } from "@/lib/metodi-pagamento";
import { createClient } from "@/lib/supabase/client";

export type OpzioniServizio = {
  tipi: { id: string; nome: string; icona: string | null; preavviso_default: number }[];
  clienti: { id: string; nome: string }[];
  metodi: { id: string; nome: string; tipo: TipoMetodo; ultime_cifre: string | null }[];
  /** Categorie di spesa non archiviate (solo con il permesso budget). */
  categorie: Categoria[];
  /** Può vedere e scrivere costi e prezzi (owner o permesso budget in scrittura). */
  puoBudget: boolean;
};

async function carica(): Promise<OpzioniServizio> {
  const supabase = createClient();
  const [tipi, clienti, budget, metodi, categorie] = await Promise.all([
    supabase.from("tipi_servizio").select("id, nome, icona, preavviso_default").order("nome"),
    supabase.from("clienti").select("id, nome_breve, ragione_sociale").neq("stato", "archiviato").order("ragione_sociale"),
    supabase.rpc("puo", { p_sezione: "budget", p_livello: "scrittura" }),
    supabase
      .from("metodi_pagamento")
      .select("id, nome, tipo, ultime_cifre")
      .eq("archiviato", false)
      .order("ordine")
      .order("nome"),
    supabase
      .from("categorie")
      .select("id, nome, parent_id, ambito, colore, icona, budget_default, ordine, archiviata")
      .eq("archiviata", false)
      .order("ordine")
      .order("nome"),
  ]);
  return {
    tipi: tipi.data ?? [],
    clienti: (clienti.data ?? []).map((c) => ({ id: c.id, nome: nomeCliente(c) })),
    metodi: metodi.data ?? [],
    categorie: categorie.data ?? [],
    puoBudget: budget.data === true,
  };
}

/** Tipi di servizio e clienti selezionabili, per il form del servizio ovunque si apra. */
export function useOpzioniServizio(enabled = true) {
  return useQuery({ queryKey: ["opzioni-servizio"], queryFn: carica, enabled, staleTime: 60_000 });
}
