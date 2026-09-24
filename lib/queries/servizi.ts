import "server-only";

import type { FiltroAmbito } from "@/lib/ambito";
import { nomeCliente } from "@/lib/clienti";
import { createClient } from "@/lib/supabase/server";

const LOGO_TTL = 60 * 60;

export type ClienteCollegato = {
  id: string;
  nome: string;
  colore: string | null;
  sito: string | null;
  logo_url: string | null;
  prezzo_rivendita: number | null;
};

/** Servizi con clienti collegati e prezzi di rivendita (se visibili). */
export async function listServizi({ ambito = "tutto", clienteId }: { ambito?: FiltroAmbito; clienteId?: string } = {}) {
  const supabase = await createClient();

  let servizioIds: string[] | null = null;
  if (clienteId) {
    const { data } = await supabase.from("servizi_clienti").select("servizio_id").eq("cliente_id", clienteId);
    servizioIds = (data ?? []).map((r) => r.servizio_id);
    if (servizioIds.length === 0) return [];
  }

  let query = supabase.from("v_servizi").select("*").order("prossima_scadenza").order("nome");
  if (ambito !== "tutto") query = query.eq("ambito", ambito);
  if (servizioIds) query = query.in("id", servizioIds);
  const { data: servizi, error } = await query;
  if (error) throw new Error(`Lettura servizi non riuscita: ${error.message}`);
  const ids = servizi.flatMap((s) => (s.id ? [s.id] : []));
  if (ids.length === 0) return [];

  const [links, prezzi] = await Promise.all([
    supabase
      .from("servizi_clienti")
      .select("servizio_id, clienti(id, nome_breve, ragione_sociale, logo_path, colore, sito)")
      .in("servizio_id", ids),
    supabase.from("servizi_clienti_economico").select("servizio_id, cliente_id, prezzo_rivendita").in("servizio_id", ids),
  ]);

  const logoPaths = [...new Set((links.data ?? []).flatMap((l) => (l.clienti?.logo_path ? [l.clienti.logo_path] : [])))];
  const signed = logoPaths.length
    ? (await supabase.storage.from("loghi").createSignedUrls(logoPaths, LOGO_TTL)).data ?? []
    : [];
  const logoUrl = new Map(signed.flatMap((s) => (s.path && s.signedUrl ? [[s.path, s.signedUrl] as const] : [])));
  const prezzo = new Map((prezzi.data ?? []).map((p) => [`${p.servizio_id}:${p.cliente_id}`, p.prezzo_rivendita]));

  const clientiPerServizio = new Map<string, ClienteCollegato[]>();
  for (const l of links.data ?? []) {
    if (!l.clienti) continue;
    const lista = clientiPerServizio.get(l.servizio_id) ?? [];
    lista.push({
      id: l.clienti.id,
      nome: nomeCliente(l.clienti),
      colore: l.clienti.colore,
      sito: l.clienti.sito,
      logo_url: l.clienti.logo_path ? (logoUrl.get(l.clienti.logo_path) ?? null) : null,
      prezzo_rivendita: prezzo.get(`${l.servizio_id}:${l.clienti.id}`) ?? null,
    });
    clientiPerServizio.set(l.servizio_id, lista);
  }

  return servizi.map((s) => ({
    ...s,
    id: s.id as string,
    clienti: (clientiPerServizio.get(s.id as string) ?? []).sort((a, b) => a.nome.localeCompare(b.nome, "it")),
  }));
}

export type ServizioLista = Awaited<ReturnType<typeof listServizi>>[number];

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
