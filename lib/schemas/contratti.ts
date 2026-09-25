import { z } from "zod";

import { parseImporto } from "@/lib/servizi";

const testo = z.string().trim();
const data = z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/, "Data non valida");

const prezzo = testo.min(1, "Inserisci il prezzo").refine((v) => {
  const n = parseImporto(v);
  return n !== null && Number.isFinite(n) && n >= 0;
}, "Importo non valido");

export const contrattoSchema = z
  .object({
    cliente_id: z.uuid("Scegli il cliente"),
    titolo: testo.max(200, "Al massimo 200 caratteri"),
    stato: z.enum(["attivo", "concluso"]),
    data_inizio: data,
    data_fine: data,
    note: testo,
    // Le voci sono prestazioni libere ("Creazione sito web") con il prezzo
    // concordato; i servizi del database si collegano come dettaglio.
    voci: z
      .array(
        z.object({
          descrizione: testo.min(1, "Descrivi la voce").max(200, "Al massimo 200 caratteri"),
          prezzo,
          servizi: z.array(z.uuid()).max(50),
        }),
      )
      .min(1, "Aggiungi almeno una voce")
      .max(100),
  })
  .check((ctx) => {
    const { data_inizio, data_fine } = ctx.value;
    if (data_inizio && data_fine && data_fine < data_inizio) {
      ctx.issues.push({
        code: "custom",
        message: "La fine viene prima dell'inizio",
        path: ["data_fine"],
        input: data_fine,
      });
    }
  });

export type ContrattoFormValues = z.infer<typeof contrattoSchema>;

export function contrattoVuoto(clienteId = ""): ContrattoFormValues {
  return {
    cliente_id: clienteId,
    titolo: "",
    stato: "attivo",
    data_inizio: "",
    data_fine: "",
    note: "",
    voci: [{ descrizione: "", prezzo: "", servizi: [] }],
  };
}

const numero = (v: string) => {
  const n = parseImporto(v);
  return n === null ? "" : String(n);
};

/** Argomenti per la funzione SQL salva_contratto. */
export function contrattoToRpc(v: ContrattoFormValues) {
  return {
    p_contratto: {
      cliente_id: v.cliente_id,
      titolo: v.titolo,
      stato: v.stato,
      data_inizio: v.data_inizio,
      data_fine: v.data_fine,
      note: v.note,
    },
    p_voci: v.voci.map((r) => ({ descrizione: r.descrizione, prezzo: numero(r.prezzo), servizi: r.servizi })),
  };
}
