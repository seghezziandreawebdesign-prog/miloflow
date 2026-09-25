import type { SupabaseClient } from "@supabase/supabase-js";

import { nomeCliente } from "@/lib/clienti";
import type { Database } from "@/lib/supabase/database.types";

/**
 * Query dei contratti, parametrizzate sul client Supabase: le usano sia il
 * server (pagina /contratti) sia il browser (pannello del contratto).
 * L'RLS le limita a chi ha il permesso budget.
 */

type Supa = SupabaseClient<Database>;

const LOGO_TTL = 60 * 60; // 1 ora

export type ServizioVoce = {
  id: string;
  nome: string;
  tipo_icona: string | null;
  stato: string;
};

export type VoceContratto = {
  id: string;
  descrizione: string;
  prezzo: number;
  servizi: ServizioVoce[];
};

export async function caricaContratti(supabase: Supa, filtro: { id?: string; clienteId?: string } = {}) {
  let query = supabase
    .from("contratti")
    .select("*, clienti(id, nome_breve, ragione_sociale, logo_path, colore, sito)")
    .order("stato")
    .order("created_at", { ascending: false });
  if (filtro.id) query = query.eq("id", filtro.id);
  if (filtro.clienteId) query = query.eq("cliente_id", filtro.clienteId);
  const { data: contratti, error } = await query;
  if (error) throw new Error(`Lettura contratti non riuscita: ${error.message}`);
  if (contratti.length === 0) return [];

  const ids = contratti.map((c) => c.id);
  const { data: voci, error: errVoci } = await supabase
    .from("contratti_voci")
    .select("id, contratto_id, descrizione, prezzo, ordine, contratti_voci_servizi(servizio_id, servizi(id, nome, stato, tipi_servizio(icona)))")
    .in("contratto_id", ids)
    .order("ordine")
    .order("created_at");
  if (errVoci) throw new Error(`Lettura contratti non riuscita: ${errVoci.message}`);

  const logoPaths = [...new Set(contratti.flatMap((c) => (c.clienti?.logo_path ? [c.clienti.logo_path] : [])))];
  const signed = logoPaths.length
    ? ((await supabase.storage.from("loghi").createSignedUrls(logoPaths, LOGO_TTL)).data ?? [])
    : [];
  const logoUrl = new Map(signed.flatMap((s) => (s.path && s.signedUrl ? [[s.path, s.signedUrl] as const] : [])));

  const vociPerContratto = new Map<string, VoceContratto[]>();
  for (const v of voci ?? []) {
    const lista = vociPerContratto.get(v.contratto_id) ?? [];
    lista.push({
      id: v.id,
      descrizione: v.descrizione,
      prezzo: v.prezzo,
      servizi: v.contratti_voci_servizi.flatMap((l) =>
        l.servizi
          ? [
              {
                id: l.servizi.id,
                nome: l.servizi.nome,
                tipo_icona: l.servizi.tipi_servizio?.icona ?? null,
                stato: l.servizi.stato,
              },
            ]
          : [],
      ),
    });
    vociPerContratto.set(v.contratto_id, lista);
  }

  return contratti.map((c) => {
    const lista = vociPerContratto.get(c.id) ?? [];
    return {
      id: c.id,
      titolo: c.titolo,
      stato: c.stato,
      data_inizio: c.data_inizio,
      data_fine: c.data_fine,
      note: c.note,
      cliente_id: c.cliente_id,
      cliente: c.clienti
        ? {
            id: c.clienti.id,
            nome: nomeCliente(c.clienti),
            colore: c.clienti.colore,
            sito: c.clienti.sito,
            logo_url: c.clienti.logo_path ? (logoUrl.get(c.clienti.logo_path) ?? null) : null,
          }
        : null,
      voci: lista,
      totale: totaleContratto(lista),
    };
  });
}

export type ContrattoLista = Awaited<ReturnType<typeof caricaContratti>>[number];

/** Il totale del contratto: la somma dei prezzi delle voci. */
export function totaleContratto(voci: Pick<VoceContratto, "prezzo">[]) {
  return Math.round(voci.reduce((sum, v) => sum + v.prezzo, 0) * 100) / 100;
}
