"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import type { FiltroAmbito } from "@/lib/ambito";
import { nomeCliente } from "@/lib/clienti";
import type { TipoEntita } from "@/lib/entita";
import { createClient } from "@/lib/supabase/client";

export type RisultatoRicerca = {
  tipo: TipoEntita;
  id: string;
  titolo: string;
  dettaglio: string | null;
  /** Task completate e servizi non attivi: in fondo e attenuati. */
  secondario: boolean;
};

const PER_TIPO = 5;

/** Toglie i caratteri che hanno un significato nei filtri di PostgREST. */
export function pulisciRicerca(testo: string): string {
  return testo.replace(/[%_*,()\\"']/g, " ").replace(/\s+/g, " ").trim();
}

async function cerca(testo: string, ambito: FiltroAmbito): Promise<RisultatoRicerca[]> {
  const supabase = createClient();
  const like = `%${testo}%`;
  // Dentro or() il valore va tra virgolette: può contenere punti e spazi.
  const q = `"${like}"`;
  const soloAmbito = <Q extends { eq: (c: "ambito", v: "lavoro" | "personale") => Q }>(query: Q) =>
    ambito === "tutto" ? query : query.eq("ambito", ambito);

  const [clienti, progetti, task, servizi, eventi] = await Promise.all([
    // I clienti sono sempre di lavoro.
    ambito === "personale"
      ? Promise.resolve({ data: [] })
      : supabase
          .from("clienti")
          .select("id, nome_breve, ragione_sociale, citta, stato")
          .or(`ragione_sociale.ilike.${q},nome_breve.ilike.${q},piva.ilike.${q}`)
          .order("ragione_sociale")
          .limit(PER_TIPO),
    soloAmbito(supabase.from("progetti").select("id, nome, stato, clienti(nome_breve, ragione_sociale)"))
      .ilike("nome", like)
      .order("nome")
      .limit(PER_TIPO),
    soloAmbito(supabase.from("task").select("id, titolo, stato, data_pianificata, progetti(nome)"))
      .ilike("titolo", like)
      .order("created_at", { ascending: false })
      .limit(PER_TIPO * 3),
    soloAmbito(supabase.from("servizi").select("id, nome, fornitore, stato"))
      .or(`nome.ilike.${q},fornitore.ilike.${q}`)
      .order("nome")
      .limit(PER_TIPO),
    soloAmbito(supabase.from("eventi").select("id, titolo, inizio"))
      .ilike("titolo", like)
      .order("inizio", { ascending: false })
      .limit(PER_TIPO),
  ]);

  const taskOrdinate = [...(task.data ?? [])]
    .sort((a, b) => Number(a.stato === "fatto") - Number(b.stato === "fatto"))
    .slice(0, PER_TIPO);

  return [
    ...(clienti.data ?? []).map((c) => ({
      tipo: "cliente" as const,
      id: c.id,
      titolo: nomeCliente(c),
      dettaglio: c.citta,
      secondario: c.stato === "archiviato",
    })),
    ...(progetti.data ?? []).map((p) => ({
      tipo: "progetto" as const,
      id: p.id,
      titolo: p.nome,
      dettaglio: p.clienti ? nomeCliente(p.clienti) : null,
      secondario: p.stato === "archiviato" || p.stato === "completato",
    })),
    ...taskOrdinate.map((t) => ({
      tipo: "task" as const,
      id: t.id,
      titolo: t.titolo,
      dettaglio: t.stato === "fatto" ? "Completata" : (t.progetti?.nome ?? null),
      secondario: t.stato === "fatto",
    })),
    ...(servizi.data ?? []).map((s) => ({
      tipo: "servizio" as const,
      id: s.id,
      titolo: s.nome,
      dettaglio: s.fornitore,
      secondario: s.stato !== "attivo",
    })),
    ...(eventi.data ?? []).map((e) => ({
      tipo: "evento" as const,
      id: e.id,
      titolo: e.titolo,
      dettaglio: new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", dateStyle: "short" }).format(new Date(e.inizio)),
      secondario: false,
    })),
  ];
}

/** Ricerca con attesa di 200 ms dopo l'ultimo tasto, da 2 caratteri in su. */
export function useRicercaEntita(testo: string, ambito: FiltroAmbito) {
  const [ritardato, setRitardato] = useState(testo);
  useEffect(() => {
    const t = setTimeout(() => setRitardato(testo), 200);
    return () => clearTimeout(t);
  }, [testo]);
  const pulito = pulisciRicerca(ritardato);
  return useQuery({
    queryKey: ["ricerca", pulito, ambito],
    queryFn: () => cerca(pulito, ambito),
    enabled: pulito.length >= 2,
    placeholderData: keepPreviousData,
    staleTime: 10_000,
  });
}
