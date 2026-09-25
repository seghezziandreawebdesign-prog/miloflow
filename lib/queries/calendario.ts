import "server-only";

import type { VistaCalendario } from "@/lib/calendario";
import { createClient } from "@/lib/supabase/server";

export type ImpostazioniCalendarioRiga = {
  intervallo_minuti: number;
  ora_inizio: string;
  ora_fine: string;
  vista_default: VistaCalendario;
  token_ics: string | null;
  ics_include: string[];
  ics_ambito: "lavoro" | "personale" | null;
};

const DEFAULT: ImpostazioniCalendarioRiga = {
  intervallo_minuti: 30,
  ora_inizio: "07:00",
  ora_fine: "21:00",
  vista_default: "settimana",
  token_ics: null,
  ics_include: ["task", "deadline", "scadenza_servizio", "evento"],
  ics_ambito: null,
};

/** I calendari esterni dell'utente, per le Impostazioni. */
export async function leggiCalendariEsterni() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("calendari_esterni")
    .select("id, nome, url, colore, ambito, attivo, ultimo_sync, errore_sync")
    .order("created_at");
  return data ?? [];
}

/** Le preferenze del calendario dell'utente, create al primo accesso. */
export async function leggiImpostazioniCalendario(): Promise<ImpostazioniCalendarioRiga> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("mie_impostazioni_calendario").maybeSingle();
  if (!data) return DEFAULT;
  return {
    intervallo_minuti: data.intervallo_minuti,
    ora_inizio: data.ora_inizio.slice(0, 5),
    ora_fine: data.ora_fine.slice(0, 5),
    vista_default: data.vista_default as VistaCalendario,
    token_ics: data.token_ics,
    ics_include: data.ics_include,
    ics_ambito: data.ics_ambito,
  };
}
