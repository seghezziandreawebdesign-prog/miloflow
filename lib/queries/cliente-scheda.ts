import type { SupabaseClient } from "@supabase/supabase-js";

import type { FiltroAmbito } from "@/lib/ambito";
import { nomeCliente } from "@/lib/clienti";
import type { Database } from "@/lib/supabase/database.types";

/**
 * Query della scheda cliente e dei suoi servizi, parametrizzate sul client
 * Supabase: le usano sia il server (pagina /clienti/[id]) sia il browser
 * (pannello del cliente).
 */

type Supa = SupabaseClient<Database>;

const LOGO_TTL = 60 * 60; // 1 ora

async function signedLogoUrls(supabase: Supa, paths: string[]): Promise<Map<string, string>> {
  if (paths.length === 0) return new Map();
  const { data } = await supabase.storage.from("loghi").createSignedUrls(paths, LOGO_TTL);
  return new Map((data ?? []).flatMap((d) => (d.path && d.signedUrl ? [[d.path, d.signedUrl] as const] : [])));
}

/** Cliente con contatti, link e diario; null se non esiste o non è visibile. */
export async function caricaSchedaCliente(supabase: Supa, id: string) {
  const [cliente, contatti, link, diario] = await Promise.all([
    supabase.from("clienti").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("clienti_contatti")
      .select("*")
      .eq("cliente_id", id)
      .order("principale", { ascending: false })
      .order("nome"),
    supabase.from("clienti_link").select("*").eq("cliente_id", id).order("ordine").order("created_at"),
    supabase
      .from("clienti_diario")
      .select("*")
      .eq("cliente_id", id)
      .order("data", { ascending: false })
      .order("created_at", { ascending: false }),
  ]);
  if (cliente.error) throw new Error(`Lettura cliente non riuscita: ${cliente.error.message}`);
  if (!cliente.data) return null;

  const urls = await signedLogoUrls(supabase, cliente.data.logo_path ? [cliente.data.logo_path] : []);
  return {
    cliente: {
      ...cliente.data,
      logo_url: cliente.data.logo_path ? (urls.get(cliente.data.logo_path) ?? null) : null,
    },
    contatti: contatti.data ?? [],
    link: link.data ?? [],
    diario: diario.data ?? [],
  };
}

export type ClienteCollegato = {
  id: string;
  nome: string;
  colore: string | null;
  sito: string | null;
  logo_url: string | null;
  prezzo_rivendita: number | null;
};

/** Servizi con clienti collegati e prezzi di rivendita (se visibili). */
export async function caricaServizi(
  supabase: Supa,
  { ambito = "tutto", clienteId }: { ambito?: FiltroAmbito; clienteId?: string } = {},
) {
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
  const logoUrl = await signedLogoUrls(supabase, logoPaths);
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

export type SchedaCliente = NonNullable<Awaited<ReturnType<typeof caricaSchedaCliente>>>;
export type ServizioLista = Awaited<ReturnType<typeof caricaServizi>>[number];
