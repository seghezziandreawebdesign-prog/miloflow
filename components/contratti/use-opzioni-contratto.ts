"use client";

import { useQuery } from "@tanstack/react-query";

import { nomeCliente } from "@/lib/clienti";
import { createClient } from "@/lib/supabase/client";

export type ServizioOpzione = {
  id: string;
  nome: string;
  stato: string;
  tipo_icona: string | null;
};

export type OpzioniContratto = {
  clienti: { id: string; nome: string }[];
  servizi: ServizioOpzione[];
  /** Clienti collegati a ogni servizio: i servizi del cliente scelto vengono prima. */
  clientiDelServizio: Map<string, string[]>;
};

async function carica(): Promise<OpzioniContratto> {
  const supabase = createClient();
  const [clienti, servizi, links] = await Promise.all([
    supabase.from("clienti").select("id, nome_breve, ragione_sociale").neq("stato", "archiviato").order("ragione_sociale"),
    supabase.from("v_servizi").select("id, nome, stato, tipo_icona").neq("stato", "archiviato").order("nome"),
    supabase.from("servizi_clienti").select("servizio_id, cliente_id"),
  ]);
  const clientiDelServizio = new Map<string, string[]>();
  for (const l of links.data ?? []) {
    clientiDelServizio.set(l.servizio_id, [...(clientiDelServizio.get(l.servizio_id) ?? []), l.cliente_id]);
  }
  return {
    clienti: (clienti.data ?? []).map((c) => ({ id: c.id, nome: nomeCliente(c) })),
    servizi: (servizi.data ?? []).flatMap((s) =>
      s.id && s.nome ? [{ id: s.id, nome: s.nome, stato: s.stato ?? "attivo", tipo_icona: s.tipo_icona }] : [],
    ),
    clientiDelServizio,
  };
}

/** Clienti e servizi selezionabili nel form del contratto. */
export function useOpzioniContratto(enabled = true) {
  return useQuery({ queryKey: ["opzioni-contratto"], queryFn: carica, enabled, staleTime: 60_000 });
}
