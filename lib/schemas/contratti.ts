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
    servizi: z
      .array(z.object({ servizio_id: z.uuid(), prezzo }))
      .min(1, "Aggiungi almeno un servizio")
      .max(100),
  })
  .check((ctx) => {
    const { data_inizio, data_fine, servizi } = ctx.value;
    if (data_inizio && data_fine && data_fine < data_inizio) {
      ctx.issues.push({
        code: "custom",
        message: "La fine viene prima dell'inizio",
        path: ["data_fine"],
        input: data_fine,
      });
    }
    const visti = new Set<string>();
    for (const [i, r] of servizi.entries()) {
      if (visti.has(r.servizio_id)) {
        ctx.issues.push({
          code: "custom",
          message: "Servizio già nel contratto",
          path: ["servizi", i, "servizio_id"],
          input: r.servizio_id,
        });
      }
      visti.add(r.servizio_id);
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
    servizi: [],
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
    p_servizi: v.servizi.map((r) => ({ servizio_id: r.servizio_id, prezzo: numero(r.prezzo) })),
  };
}
