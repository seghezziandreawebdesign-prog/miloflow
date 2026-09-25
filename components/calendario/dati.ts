"use client";

import { keepPreviousData, useQuery, type QueryClient } from "@tanstack/react-query";

import type { FiltroAmbito } from "@/lib/ambito";
import type { RigaCalendario, TipoCalendario } from "@/lib/calendario";
import { fromLocalDateTime } from "@/lib/dates/format";
import { addDays } from "@/lib/dates/giorni";
import { createClient } from "@/lib/supabase/client";

export const chiaviCalendario = {
  tutte: ["calendario"] as const,
  intervallo: (dal: string, al: string, ambito: FiltroAmbito) => ["calendario", dal, al, ambito] as const,
};

/**
 * Righe di v_calendario per l'intervallo [dal, al] (giorni di Roma, inclusi).
 * Gli eventi ricorrenti si leggono tutti quelli iniziati prima della fine:
 * le occorrenze si calcolano nel client.
 */
async function leggiCalendario(dal: string, al: string, ambito: FiltroAmbito): Promise<RigaCalendario[]> {
  const supabase = createClient();
  const da = fromLocalDateTime(`${dal}T00:00`).toISOString();
  const a = fromLocalDateTime(`${addDays(al, 1)}T00:00`).toISOString();
  let singoli = supabase
    .from("v_calendario")
    .select("*")
    .is("ricorrenza", null)
    .lt("inizio", a)
    .or(`fine.gte.${da},and(fine.is.null,inizio.gte.${da})`);
  let ricorrenti = supabase.from("v_calendario").select("*").not("ricorrenza", "is", null).lt("inizio", a);
  // Occorrenze dei calendari esterni: già espanse alla sincronizzazione.
  let esterni = supabase
    .from("eventi_esterni")
    .select("id, titolo, inizio, fine, tutto_il_giorno, luogo, note, calendari_esterni!inner(nome, colore, ambito, attivo)")
    .eq("calendari_esterni.attivo", true)
    .lt("inizio", a)
    .or(`fine.gte.${da},and(fine.is.null,inizio.gte.${da})`);
  if (ambito !== "tutto") {
    singoli = singoli.eq("ambito", ambito);
    ricorrenti = ricorrenti.eq("ambito", ambito);
    esterni = esterni.eq("calendari_esterni.ambito", ambito);
  }
  const [s, r, e] = await Promise.all([singoli, ricorrenti, esterni]);
  if (s.error) throw new Error(`Lettura calendario non riuscita: ${s.error.message}`);
  if (r.error) throw new Error(`Lettura calendario non riuscita: ${r.error.message}`);
  if (e.error) throw new Error(`Lettura calendari esterni non riuscita: ${e.error.message}`);
  const righeEsterne: RigaCalendario[] = (e.data ?? []).map((x) => ({
    id: x.id,
    tipo: "esterno",
    titolo: x.titolo,
    inizio: x.inizio,
    fine: x.fine,
    tutto_il_giorno: x.tutto_il_giorno,
    ambito: x.calendari_esterni.ambito,
    cliente_id: null,
    progetto_id: null,
    colore: null,
    modificabile: false,
    ricorrenza: null,
    colore_sfondo: x.calendari_esterni.colore,
    luogo: x.luogo,
    note: x.note,
    origine: x.calendari_esterni.nome,
  }));
  // Le colonne della vista arrivano come facoltative: qui si normalizzano.
  return righeEsterne.concat([...s.data, ...r.data].flatMap((x) =>
    x.id && x.tipo && x.titolo && x.inizio && x.ambito
      ? [
          {
            id: x.id,
            tipo: x.tipo as TipoCalendario,
            titolo: x.titolo,
            inizio: x.inizio,
            fine: x.fine,
            tutto_il_giorno: x.tutto_il_giorno ?? true,
            ambito: x.ambito,
            cliente_id: x.cliente_id,
            progetto_id: x.progetto_id,
            colore: x.colore,
            modificabile: x.modificabile ?? false,
            ricorrenza: x.ricorrenza,
            colore_sfondo: x.colore_sfondo,
          },
        ]
      : [],
  ));
}

export function useCalendario(dal: string | null, al: string | null, ambito: FiltroAmbito) {
  return useQuery({
    queryKey: chiaviCalendario.intervallo(dal ?? "", al ?? "", ambito),
    queryFn: () => leggiCalendario(dal ?? "", al ?? "", ambito),
    enabled: dal !== null && al !== null,
    placeholderData: keepPreviousData,
  });
}

export function invalidaCalendario(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: chiaviCalendario.tutte });
}
