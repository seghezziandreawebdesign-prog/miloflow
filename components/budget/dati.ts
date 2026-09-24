"use client";

import { useQuery, type QueryClient } from "@tanstack/react-query";

import type { Categoria } from "@/lib/budget";
import type { TipoMetodo } from "@/lib/metodi-pagamento";
import { createClient } from "@/lib/supabase/client";

export type MetodoOpzione = { id: string; nome: string; tipo: TipoMetodo; ultime_cifre: string | null; ambito: "lavoro" | "personale" | "entrambi" };

export type OpzioniBudget = {
  categorie: Categoria[];
  metodi: MetodoOpzione[];
  /** Può scrivere nel budget (owner o permesso budget in scrittura). */
  puoScrivere: boolean;
};

async function carica(): Promise<OpzioniBudget> {
  const supabase = createClient();
  const [categorie, metodi, scrittura] = await Promise.all([
    supabase
      .from("categorie")
      .select("id, nome, parent_id, ambito, colore, icona, budget_default, ordine, archiviata")
      .order("ordine")
      .order("nome"),
    supabase
      .from("metodi_pagamento")
      .select("id, nome, tipo, ultime_cifre, ambito")
      .eq("archiviato", false)
      .order("ordine")
      .order("nome"),
    supabase.rpc("puo", { p_sezione: "budget", p_livello: "scrittura" }),
  ]);
  return { categorie: categorie.data ?? [], metodi: metodi.data ?? [], puoScrivere: scrittura.data === true };
}

export const chiaviBudget = {
  opzioni: ["budget", "opzioni"] as const,
  movimento: (id: string) => ["movimento", id] as const,
  debito: (id: string) => ["debito", id] as const,
};

/** Categorie e metodi di pagamento per i form del budget, ovunque si aprano. */
export function useOpzioniBudget(enabled = true) {
  return useQuery({ queryKey: chiaviBudget.opzioni, queryFn: carica, enabled, staleTime: 60_000 });
}

/** Dopo una scrittura: pannelli aperti, calendario e opzioni. */
export function invalidaBudget(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: ["movimento"] });
  void queryClient.invalidateQueries({ queryKey: ["debito"] });
  void queryClient.invalidateQueries({ queryKey: ["calendario"] });
  void queryClient.invalidateQueries({ queryKey: chiaviBudget.opzioni });
}
