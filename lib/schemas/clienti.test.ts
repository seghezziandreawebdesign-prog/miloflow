import { describe, expect, it } from "vitest";

import { clienteSchema, clienteToRow, clienteVuoto } from "./clienti";

const base = { ...clienteVuoto, ragione_sociale: "Ferrari S.p.A." };

function errori(values: Partial<typeof base>) {
  const r = clienteSchema.safeParse({ ...base, ...values });
  return r.success ? {} : Object.fromEntries(r.error.issues.map((i) => [i.path.join("."), i.message]));
}

describe("clienteSchema", () => {
  it("accetta un cliente minimo", () => {
    expect(errori({})).toEqual({});
  });

  it("blocca una P.IVA italiana con checksum errato", () => {
    expect(errori({ piva: "00159560367" })).toHaveProperty("piva");
    expect(errori({ piva: "IT 00159560366" })).toEqual({});
  });

  it("controlla solo il formato per le P.IVA estere", () => {
    expect(errori({ nazione: "DE", piva: "811569869" })).toEqual({});
    expect(errori({ nazione: "DE", piva: "con spazi e simboli!" })).toHaveProperty("piva");
  });

  it("valida CF, SDI, CAP, provincia, PEC e sito", () => {
    expect(errori({ codice_fiscale: "RSSMRA85T10A562T" })).toHaveProperty("codice_fiscale");
    expect(errori({ codice_sdi: "12" })).toHaveProperty("codice_sdi");
    expect(errori({ cap: "4112" })).toHaveProperty("cap");
    expect(errori({ provincia: "MOD" })).toHaveProperty("provincia");
    expect(errori({ pec: "non-una-mail" })).toHaveProperty("pec");
    expect(errori({ sito: "senza punto" })).toHaveProperty("sito");
    expect(errori({ nazione: "FR", cap: "75002", provincia: "Île-de-France" })).toEqual({});
  });

  it("richiede la ragione sociale", () => {
    expect(errori({ ragione_sociale: "   " })).toHaveProperty("ragione_sociale");
  });
});

describe("clienteToRow", () => {
  it("normalizza i campi prima del salvataggio", () => {
    const row = clienteToRow({
      ...base,
      piva: "IT 001 59560366",
      codice_fiscale: "rssmra85t10a562s",
      codice_sdi: "abc1234",
      provincia: "mo",
      sito: "ferrari.com",
      email: "Info@Ferrari.com",
      tags: ["Auto", "auto", "Clienti top"],
      nome_breve: "",
    });
    expect(row).toMatchObject({
      piva: "00159560366",
      codice_fiscale: "RSSMRA85T10A562S",
      codice_sdi: "ABC1234",
      provincia: "MO",
      sito: "https://ferrari.com",
      email: "info@ferrari.com",
      tags: ["auto", "clienti top"],
      nome_breve: null,
    });
  });
});
