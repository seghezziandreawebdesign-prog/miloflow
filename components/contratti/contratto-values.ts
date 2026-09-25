import type { ContrattoLista } from "@/lib/queries/contratti";
import type { ContrattoFormValues } from "@/lib/schemas/contratti";

const numero = (v: number) => String(v).replace(".", ",");

/** Valori del form a partire da un contratto caricato. */
export function contrattoToForm(c: ContrattoLista): ContrattoFormValues {
  return {
    cliente_id: c.cliente_id,
    titolo: c.titolo ?? "",
    stato: c.stato,
    data_inizio: c.data_inizio ?? "",
    data_fine: c.data_fine ?? "",
    note: c.note ?? "",
    voci: c.voci.map((v) => ({
      descrizione: v.descrizione,
      prezzo: numero(v.prezzo),
      servizi: v.servizi.map((s) => s.id),
    })),
  };
}
