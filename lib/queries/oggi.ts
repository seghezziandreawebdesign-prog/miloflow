import "server-only";

import type { FiltroAmbito } from "@/lib/ambito";
import { addDays } from "@/lib/dates/giorni";
import { eventiDelGiorno } from "@/lib/eventi";
import { createClient } from "@/lib/supabase/server";

const COLONNE_EVENTO = "id, titolo, inizio, fine, tutto_il_giorno, ricorrenza, luogo, link_call, ambito";

/** Eventi che cadono oggi, ricorrenze comprese. */
export async function eventiDiOggi(oggi: string, ambito: FiltroAmbito) {
  const supabase = await createClient();
  // Finestra larga in UTC; il giorno esatto (ora di Roma) lo decide eventiDelGiorno.
  const da = `${addDays(oggi, -2)}T00:00:00Z`;
  const a = `${addDays(oggi, 2)}T00:00:00Z`;
  let singoli = supabase
    .from("eventi")
    .select(COLONNE_EVENTO)
    .is("ricorrenza", null)
    .lte("inizio", a)
    .or(`fine.gte.${da},and(fine.is.null,inizio.gte.${da})`);
  let ricorrenti = supabase.from("eventi").select(COLONNE_EVENTO).not("ricorrenza", "is", null).lte("inizio", a);
  if (ambito !== "tutto") {
    singoli = singoli.eq("ambito", ambito);
    ricorrenti = ricorrenti.eq("ambito", ambito);
  }
  const [s, r] = await Promise.all([singoli, ricorrenti]);
  if (s.error) throw new Error(`Lettura eventi non riuscita: ${s.error.message}`);
  if (r.error) throw new Error(`Lettura eventi non riuscita: ${r.error.message}`);
  return eventiDelGiorno([...s.data, ...r.data], oggi);
}

export type EventoDiOggi = Awaited<ReturnType<typeof eventiDiOggi>>[number];

/** Servizi attivi scaduti o in scadenza entro `giorni` giorni. */
export async function serviziInScadenza(oggi: string, ambito: FiltroAmbito, giorni = 14) {
  const supabase = await createClient();
  let q = supabase
    .from("v_servizi")
    .select("id, nome, ambito, tipo_icona, tipo_nome, prossima_scadenza, giorni_alla_scadenza, stato_scadenza, rinnovo_automatico")
    .eq("stato", "attivo")
    .lte("prossima_scadenza", addDays(oggi, giorni))
    .order("prossima_scadenza")
    .order("nome");
  if (ambito !== "tutto") q = q.eq("ambito", ambito);
  const { data, error } = await q;
  if (error) throw new Error(`Lettura servizi non riuscita: ${error.message}`);
  return data;
}

export type ServizioInScadenza = Awaited<ReturnType<typeof serviziInScadenza>>[number];
