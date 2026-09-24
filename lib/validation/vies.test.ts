import { describe, expect, it } from "vitest";

import { normalizzaRispostaVies, parseIndirizzo } from "@/supabase/functions/_shared/vies";

describe("normalizzaRispostaVies", () => {
  it("estrae ragione sociale e indirizzo italiano", () => {
    const risposta = {
      isValid: true,
      name: "FERRARI S.P.A.",
      address: "VIA EMILIA EST 1163 \n41122 MODENA MO\n",
    };
    expect(normalizzaRispostaVies(risposta, "IT")).toEqual({
      valida: true,
      ragioneSociale: "FERRARI S.P.A.",
      indirizzo: "Via Emilia Est 1163",
      cap: "41122",
      citta: "Modena",
      provincia: "MO",
    });
  });

  it("tratta '---' come dato mancante", () => {
    expect(normalizzaRispostaVies({ isValid: true, name: "---", address: "---" }, "DE")).toEqual({
      valida: true,
      ragioneSociale: null,
      indirizzo: null,
      cap: null,
      citta: null,
      provincia: null,
    });
  });

  it("gestisce P.IVA non valide e risposte malformate", () => {
    expect(normalizzaRispostaVies({ isValid: false }, "IT").valida).toBe(false);
    expect(normalizzaRispostaVies(null, "IT").valida).toBe(false);
  });
});

describe("parseIndirizzo", () => {
  it("tiene su una riga gli indirizzi esteri o non riconosciuti", () => {
    expect(parseIndirizzo("1 RUE DE LA PAIX\n75002 PARIS", "FR")).toEqual({
      indirizzo: "1 Rue De La Paix, 75002 Paris",
      cap: null,
      citta: null,
      provincia: null,
    });
  });

  it("gestisce città di più parole e apostrofi", () => {
    expect(parseIndirizzo("PIAZZA DELL'UNITA' 3\n34121 TRIESTE TS", "IT").indirizzo).toBe(
      "Piazza Dell'Unita' 3",
    );
    expect(parseIndirizzo("VIA ROMA 1\n21052 BUSTO ARSIZIO VA", "IT").citta).toBe("Busto Arsizio");
  });
});
