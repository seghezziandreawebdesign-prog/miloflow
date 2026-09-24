import type { ServizioFormValues } from "@/lib/schemas/servizi";
import type { Database } from "@/lib/supabase/database.types";

type VServizio = Database["public"]["Views"]["v_servizi"]["Row"];

const numero = (v: number | null | undefined) => (v === null || v === undefined ? "" : String(v).replace(".", ","));

/** Valori del form a partire da una riga di v_servizi e dai clienti collegati. */
export function servizioToForm(
  s: VServizio,
  clienti: { id: string; prezzo_rivendita: number | null }[],
): ServizioFormValues {
  return {
    nome: s.nome ?? "",
    costo: numero(s.costo),
    frequenza: s.frequenza ?? "annuale",
    prossima_scadenza: s.prossima_scadenza ?? "",
    clienti: clienti.map((c) => ({ cliente_id: c.id, prezzo_rivendita: numero(c.prezzo_rivendita) })),
    ambito: s.ambito ?? "lavoro",
    tipo_id: s.tipo_id ?? "",
    fornitore: s.fornitore ?? "",
    rinnovo_automatico: s.rinnovo_automatico ?? false,
    chi_paga: s.chi_paga ?? "io",
    metodo_pagamento_id: s.metodo_pagamento_id ?? "",
    preavviso_giorni: s.preavviso_giorni === null ? "" : String(s.preavviso_giorni),
    url_pannello: s.url_pannello ?? "",
    username: s.username ?? "",
    stato: s.stato ?? "attivo",
    note: s.note ?? "",
  };
}
