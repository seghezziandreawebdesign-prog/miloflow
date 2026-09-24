import "server-only";

import type { FiltroAmbito } from "@/lib/ambito";
import { aggiungiMesi, primoDelMese, type Categoria, type Movimento } from "@/lib/budget";
import { nomeCliente } from "@/lib/clienti";
import { addDays } from "@/lib/dates/giorni";
import { normalizzaSalvadanaio, type Salvadanaio, type TipoSalvadanaio } from "@/lib/salvadanai";
import { createClient } from "@/lib/supabase/server";

// Una sola stringa letterale: il parser dei tipi di Supabase non legge le concatenazioni.
const COLONNE_MOVIMENTO =
  "id, ambito, data, importo, descrizione, categoria_id, stato, servizio_id, rata_id, periodo, metodo_pagamento_id, ricevuta_path, created_at, categoria_nome, categoria_colore, categoria_icona, categoria_parent_id, categoria_padre_nome, metodo_nome, metodo_tipo, metodo_cifre, servizio_nome, debito_id, debito_creditore, rata_numero, salvadanaio_id, salvadanaio_nome";

type Ambitabile<Q> = Q & { eq: (col: "ambito", v: "lavoro" | "personale") => Q };

type RigaVista = {
  id: string | null;
  ambito: "lavoro" | "personale" | null;
  data: string | null;
  importo: number | null;
  descrizione: string | null;
  categoria_id: string | null;
  stato: "pagato" | "previsto" | null;
  servizio_id: string | null;
  rata_id: string | null;
  periodo: string | null;
  metodo_pagamento_id: string | null;
  ricevuta_path: string | null;
  created_at: string | null;
  categoria_nome: string | null;
  categoria_colore: string | null;
  categoria_icona: string | null;
  categoria_parent_id: string | null;
  categoria_padre_nome: string | null;
  metodo_nome: string | null;
  metodo_cifre: string | null;
  servizio_nome: string | null;
  debito_id: string | null;
  debito_creditore: string | null;
  rata_numero: number | null;
  salvadanaio_id: string | null;
  salvadanaio_nome: string | null;
};

/** Le viste generano colonne tutte nullable: qui si ristabiliscono i tipi veri. */
function normalizzaMovimento(r: RigaVista): Movimento {
  return {
    id: r.id!,
    ambito: r.ambito!,
    data: r.data!,
    importo: r.importo!,
    descrizione: r.descrizione,
    categoria_id: r.categoria_id,
    stato: r.stato!,
    servizio_id: r.servizio_id,
    rata_id: r.rata_id,
    periodo: r.periodo,
    metodo_pagamento_id: r.metodo_pagamento_id,
    ricevuta_path: r.ricevuta_path,
    created_at: r.created_at!,
    categoria_nome: r.categoria_nome,
    categoria_colore: r.categoria_colore,
    categoria_icona: r.categoria_icona,
    categoria_parent_id: r.categoria_parent_id,
    categoria_padre_nome: r.categoria_padre_nome,
    metodo_nome: r.metodo_nome,
    metodo_cifre: r.metodo_cifre,
    servizio_nome: r.servizio_nome,
    debito_id: r.debito_id,
    debito_creditore: r.debito_creditore,
    rata_numero: r.rata_numero,
    salvadanaio_id: r.salvadanaio_id,
    salvadanaio_nome: r.salvadanaio_nome,
  };
}
const perAmbito = <Q>(q: Ambitabile<Q>, ambito: FiltroAmbito): Q => (ambito === "tutto" ? q : q.eq("ambito", ambito));

/** Permessi sul budget dell'utente corrente. */
export async function permessiBudget(): Promise<{ lettura: boolean; scrittura: boolean; owner: boolean }> {
  const supabase = await createClient();
  const [lettura, scrittura, owner] = await Promise.all([
    supabase.rpc("puo", { p_sezione: "budget", p_livello: "lettura" }),
    supabase.rpc("puo", { p_sezione: "budget", p_livello: "scrittura" }),
    supabase.rpc("is_owner"),
  ]);
  return { lettura: lettura.data === true, scrittura: scrittura.data === true, owner: owner.data === true };
}

export async function leggiCategorie(): Promise<Categoria[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("categorie")
    .select("id, nome, parent_id, ambito, colore, icona, budget_default, ordine, archiviata")
    .order("ordine")
    .order("nome");
  if (error) throw new Error(`Lettura categorie non riuscita: ${error.message}`);
  return data;
}

export async function leggiMetodi() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("metodi_pagamento")
    .select("id, nome, tipo, ultime_cifre, ambito, archiviato")
    .order("ordine")
    .order("nome");
  if (error) throw new Error(`Lettura metodi non riuscita: ${error.message}`);
  return data;
}

/** Movimenti con data nel mese, i più recenti prima. */
export async function leggiMovimentiMese(mese: string, ambito: FiltroAmbito) {
  const supabase = await createClient();
  const primo = primoDelMese(mese);
  const { data, error } = await perAmbito(
    supabase.from("v_movimenti").select(COLONNE_MOVIMENTO).gte("data", primo).lt("data", aggiungiMesi(primo, 1)),
    ambito,
  )
    .order("data", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Lettura movimenti non riuscita: ${error.message}`);
  return data.map(normalizzaMovimento);
}

/** Movimenti pagati con data nel periodo (per i report). */
export async function leggiMovimentiPeriodo(dal: string, al: string, ambito: FiltroAmbito) {
  const supabase = await createClient();
  const { data, error } = await perAmbito(
    supabase.from("v_movimenti").select(COLONNE_MOVIMENTO).gte("data", dal).lte("data", al).eq("stato", "pagato"),
    ambito,
  )
    .order("data", { ascending: false })
    .limit(5000);
  if (error) throw new Error(`Lettura movimenti non riuscita: ${error.message}`);
  return data.map(normalizzaMovimento);
}

export async function leggiBudgetMese(mese: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("budget_mensili").select("categoria_id, importo").eq("mese", primoDelMese(mese));
  if (error) throw new Error(`Lettura budget non riuscita: ${error.message}`);
  return data;
}

const COLONNE_DEBITO =
  "id, ambito, creditore, descrizione, importo_totale, tipo, data_inizio, note, categoria_id, created_at, debiti_rate(id, numero, scadenza, importo, pagata, movimento_id)";

export async function leggiDebiti(ambito: FiltroAmbito) {
  const supabase = await createClient();
  const { data, error } = await perAmbito(supabase.from("debiti").select(COLONNE_DEBITO), ambito)
    .order("created_at", { ascending: false })
    .order("numero", { referencedTable: "debiti_rate" });
  if (error) throw new Error(`Lettura debiti non riuscita: ${error.message}`);
  return data;
}

export type DebitoRiga = Awaited<ReturnType<typeof leggiDebiti>>[number];

/** Risparmi o investimenti con i totali, i più recenti prima. */
export async function leggiSalvadanai(tipo: TipoSalvadanaio, ambito: FiltroAmbito): Promise<Salvadanaio[]> {
  const supabase = await createClient();
  const { data, error } = await perAmbito(supabase.from("v_salvadanai").select("*").eq("tipo", tipo), ambito).order("created_at", {
    ascending: false,
  });
  if (error) throw new Error(`Lettura non riuscita: ${error.message}`);
  return data.map(normalizzaSalvadanaio);
}

/** Servizi attivi pagati da me con costo (per il costo annuo degli abbonamenti). */
export async function leggiAbbonamenti(ambito: FiltroAmbito) {
  const supabase = await createClient();
  const { data, error } = await perAmbito(
    supabase.from("v_servizi").select("id, nome, ambito, costo, frequenza, chi_paga, tipo_nome").eq("stato", "attivo").eq("chi_paga", "io"),
    ambito,
  ).order("nome");
  if (error) throw new Error(`Lettura servizi non riuscita: ${error.message}`);
  return data.map((s) => ({ id: s.id!, nome: s.nome!, ambito: s.ambito!, costo: s.costo, frequenza: s.frequenza!, tipo: s.tipo_nome }));
}

/** Prezzi di rivendita con il costo del servizio, per il margine per cliente. */
export async function leggiRivendite() {
  const supabase = await createClient();
  // servizi_clienti_economico ha una chiave composta: si legge a parte e si unisce qui.
  const [collegamenti, prezzi] = await Promise.all([
    supabase
      .from("servizi_clienti")
      .select("servizio_id, cliente_id, clienti(nome_breve, ragione_sociale), servizi!inner(nome, frequenza, stato, servizi_economico(costo))")
      .eq("servizi.stato", "attivo"),
    supabase.from("servizi_clienti_economico").select("servizio_id, cliente_id, prezzo_rivendita"),
  ]);
  if (collegamenti.error) throw new Error(`Lettura rivendite non riuscita: ${collegamenti.error.message}`);
  if (prezzi.error) throw new Error(`Lettura rivendite non riuscita: ${prezzi.error.message}`);
  const prezzo = new Map(prezzi.data.map((p) => [`${p.servizio_id}:${p.cliente_id}`, p.prezzo_rivendita]));
  return collegamenti.data.map((r) => ({
    cliente_id: r.cliente_id,
    cliente: r.clienti ? nomeCliente(r.clienti) : "—",
    servizio: r.servizi.nome,
    frequenza: r.servizi.frequenza,
    prezzo_rivendita: prezzo.get(`${r.servizio_id}:${r.cliente_id}`) ?? null,
    costo: r.servizi.servizi_economico?.costo ?? null,
  }));
}

/** Previsti (rate comprese) da oggi a `giorni` giorni, per la pagina Oggi. */
export async function prossimiPrevisti(oggi: string, ambito: FiltroAmbito, giorni = 7) {
  const supabase = await createClient();
  const { data, error } = await perAmbito(
    supabase
      .from("v_movimenti")
      .select(COLONNE_MOVIMENTO)
      .eq("stato", "previsto")
      .lte("data", addDays(oggi, giorni)),
    ambito,
  )
    .order("data")
    .limit(50);
  if (error) throw new Error(`Lettura previsti non riuscita: ${error.message}`);
  return data.map(normalizzaMovimento);
}
