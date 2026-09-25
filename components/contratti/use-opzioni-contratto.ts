"use client";

import { useQuery } from "@tanstack/react-query";

import { nomeCliente } from "@/lib/clienti";
import type { Frequenza } from "@/lib/servizi";
import { createClient } from "@/lib/supabase/client";

export type ServizioOpzione = {
  id: string;
  nome: string;
  frequenza: Frequenza;
  stato: string;
  /** Il costo che pago io per un periodo (per il margine nel form). */
  costo: number | null;
  tipo_icona: string | null;
};

export type OpzioniContratto = {
  clienti: { id: string; nome: string }[];
  servizi: ServizioOpzione[];
  /** Prezzo di rivendita già salvato per (servizio, cliente): precompila la riga. */
  prezzoRivendita: Map<string, number>;
  /** Clienti collegati a ogni servizio: i servizi del cliente scelto vengono prima. */
  clientiDelServizio: Map<string, string[]>;
};

async function carica(): Promise<OpzioniContratto> {
  const supabase = createClient();
  const [clienti, servizi, prezzi, links] = await Promise.all([
    supabase.from("clienti").select("id, nome_breve, ragione_sociale").neq("stato", "archiviato").order("ragione_sociale"),
    supabase.from("v_servizi").select("id, nome, frequenza, stato, costo, tipo_icona").neq("stato", "archiviato").order("nome"),
    supabase.from("servizi_clienti_economico").select("servizio_id, cliente_id, prezzo_rivendita"),
    supabase.from("servizi_clienti").select("servizio_id, cliente_id"),
  ]);
  const clientiDelServizio = new Map<string, string[]>();
  for (const l of links.data ?? []) {
    clientiDelServizio.set(l.servizio_id, [...(clientiDelServizio.get(l.servizio_id) ?? []), l.cliente_id]);
  }
  return {
    clienti: (clienti.data ?? []).map((c) => ({ id: c.id, nome: nomeCliente(c) })),
    servizi: (servizi.data ?? []).flatMap((s) =>
      s.id && s.nome
        ? [
            {
              id: s.id,
              nome: s.nome,
              frequenza: s.frequenza ?? "annuale",
              stato: s.stato ?? "attivo",
              costo: s.costo,
              tipo_icona: s.tipo_icona,
            },
          ]
        : [],
    ),
    prezzoRivendita: new Map(
      (prezzi.data ?? []).flatMap((p) =>
        p.prezzo_rivendita === null ? [] : [[`${p.servizio_id}:${p.cliente_id}`, p.prezzo_rivendita] as const],
      ),
    ),
    clientiDelServizio,
  };
}

/** Clienti e servizi selezionabili nel form del contratto. */
export function useOpzioniContratto(enabled = true) {
  return useQuery({ queryKey: ["opzioni-contratto"], queryFn: carica, enabled, staleTime: 60_000 });
}
