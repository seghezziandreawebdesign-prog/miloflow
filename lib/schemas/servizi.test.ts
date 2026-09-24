import { describe, expect, it } from "vitest";

import { servizioSchema, servizioToRpc, servizioVuoto } from "./servizi";

const base = { ...servizioVuoto("lavoro", "2027-03-01"), nome: "Hosting" };

function errori(values: Partial<typeof base>) {
  const r = servizioSchema.safeParse({ ...base, ...values });
  return r.success ? {} : Object.fromEntries(r.error.issues.map((i) => [i.path.join("."), i.message]));
}

describe("servizioSchema", () => {
  it("accetta un servizio minimo", () => {
    expect(errori({})).toEqual({});
  });

  it("valida importi, preavviso e pannello", () => {
    expect(errori({ costo: "12,50" })).toEqual({});
    expect(errori({ costo: "abc" })).toHaveProperty("costo");
    expect(errori({ preavviso_giorni: "400" })).toHaveProperty("preavviso_giorni");
    expect(errori({ url_pannello: "non valido" })).toHaveProperty("url_pannello");
  });

  it("rifiuta numeri di carta completi nel metodo di pagamento", () => {
    expect(errori({ metodo_pagamento: "Revolut *4417" })).toEqual({});
    expect(errori({ metodo_pagamento: "4111 1111 1111 1111" })).toHaveProperty("metodo_pagamento");
  });

  it("valida i prezzi di rivendita dei clienti", () => {
    const cliente_id = "3f2b8c1e-9a4d-4e21-8b0f-1c2d3e4f5a6b";
    expect(errori({ clienti: [{ cliente_id, prezzo_rivendita: "80" }] })).toEqual({});
    expect(errori({ clienti: [{ cliente_id, prezzo_rivendita: "-3" }] })).toHaveProperty("clienti.0.prezzo_rivendita");
  });
});

describe("servizioToRpc", () => {
  it("converte importi e link", () => {
    const rpc = servizioToRpc({
      ...base,
      costo: "1.234,50",
      url_pannello: "pannello.host.it",
      clienti: [{ cliente_id: "3f2b8c1e-9a4d-4e21-8b0f-1c2d3e4f5a6b", prezzo_rivendita: "" }],
    });
    expect(rpc.p_economico.costo).toBe("1234.5");
    expect(rpc.p_servizio.url_pannello).toBe("https://pannello.host.it");
    expect(rpc.p_clienti[0].prezzo_rivendita).toBe("");
  });
});

describe("credenzialeSchema con dati cifrati veri", () => {
  it("accetta l'output di cifraCredenziale e i parametri di creaCassaforte", { timeout: 20_000 }, async () => {
    const { creaCassaforte, cifraCredenziale } = await import("@/lib/crypto/vault");
    const { credenzialeSchema, parametriCassaforteSchema } = await import("./servizi");
    const { parametri, chiave } = await creaCassaforte("una master password lunga");
    expect(parametriCassaforteSchema.safeParse(parametri).success).toBe(true);
    for (const segreto of ["x", "una password molto lunga con spazi e àccènti €", "a".repeat(500)]) {
      const cifrata = await cifraCredenziale(chiave, segreto);
      const r = credenzialeSchema.safeParse({ tipo: "cifrata", etichetta: "FTP", ...cifrata });
      expect(r.success, JSON.stringify(r.error?.issues)).toBe(true);
    }
  });
});
