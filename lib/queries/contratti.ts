import type { SupabaseClient } from "@supabase/supabase-js";

import { nomeCliente } from "@/lib/clienti";
import { costoAnnuo, type Frequenza } from "@/lib/servizi";
import type { Database } from "@/lib/supabase/database.types";

/**
 * Query dei contratti, parametrizzate sul client Supabase: le usano sia il
 * server (pagina /contratti) sia il browser (pannello del contratto).
 * L'RLS le limita a chi ha il permesso budget.
 */

type Supa = SupabaseClient<Database>;

const LOGO_TTL = 60 * 60; // 1 ora

export type RigaContratto = {
  id: string;
  servizio_id: string;
  prezzo: number;
  nome: string;
  frequenza: Frequenza;
  stato_servizio: string;
  tipo_icona: string | null;
  /** Il costo che pago io per un periodo (null se il servizio non ne ha). */
  costo: number | null;
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
  const { data: righe, error: errRighe } = await supabase
    .from("contratti_servizi")
    .select("id, contratto_id, servizio_id, prezzo, ordine, servizi(id, nome, frequenza, stato, tipi_servizio(icona))")
    .in("contratto_id", ids)
    .order("ordine")
    .order("created_at");
  if (errRighe) throw new Error(`Lettura contratti non riuscita: ${errRighe.message}`);

  const servizioIds = [...new Set((righe ?? []).map((r) => r.servizio_id))];
  const { data: costi } = servizioIds.length
    ? await supabase.from("servizi_economico").select("servizio_id, costo").in("servizio_id", servizioIds)
    : { data: [] };
  const costo = new Map((costi ?? []).map((c) => [c.servizio_id, c.costo]));

  const logoPaths = [...new Set(contratti.flatMap((c) => (c.clienti?.logo_path ? [c.clienti.logo_path] : [])))];
  const signed = logoPaths.length
    ? ((await supabase.storage.from("loghi").createSignedUrls(logoPaths, LOGO_TTL)).data ?? [])
    : [];
  const logoUrl = new Map(signed.flatMap((s) => (s.path && s.signedUrl ? [[s.path, s.signedUrl] as const] : [])));

  const righePerContratto = new Map<string, RigaContratto[]>();
  for (const r of righe ?? []) {
    if (!r.servizi) continue;
    const lista = righePerContratto.get(r.contratto_id) ?? [];
    lista.push({
      id: r.id,
      servizio_id: r.servizio_id,
      prezzo: r.prezzo,
      nome: r.servizi.nome,
      frequenza: r.servizi.frequenza,
      stato_servizio: r.servizi.stato,
      tipo_icona: r.servizi.tipi_servizio?.icona ?? null,
      costo: costo.get(r.servizio_id) ?? null,
    });
    righePerContratto.set(r.contratto_id, lista);
  }

  return contratti.map((c) => {
    const lista = righePerContratto.get(c.id) ?? [];
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
      righe: lista,
      ...totaliContratto(lista),
    };
  });
}

export type ContrattoLista = Awaited<ReturnType<typeof caricaContratti>>[number];

/** Totale annuo normalizzato sulle frequenze, più le una tantum contate una volta. */
export function totaliContratto(righe: Pick<RigaContratto, "prezzo" | "frequenza" | "costo">[]) {
  let totaleAnnuo = 0;
  let costoAnnuoMio = 0;
  let unaTantum = 0;
  for (const r of righe) {
    if (r.frequenza === "una_tantum") {
      unaTantum += r.prezzo;
    } else {
      totaleAnnuo += costoAnnuo(r.prezzo, r.frequenza);
      costoAnnuoMio += costoAnnuo(r.costo, r.frequenza);
    }
  }
  return {
    totale_annuo: Math.round(totaleAnnuo * 100) / 100,
    costo_annuo_mio: Math.round(costoAnnuoMio * 100) / 100,
    una_tantum: Math.round(unaTantum * 100) / 100,
  };
}
