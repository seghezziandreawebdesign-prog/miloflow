import { describe, expect, it } from "vitest";

import { isValidCodiceFiscale, isValidPivaIT, normalizePiva } from "./fiscale";

describe("normalizePiva", () => {
  it("toglie spazi, punti e prefisso del paese", () => {
    expect(normalizePiva("IT 001 595.603-66", "IT")).toBe("00159560366");
    expect(normalizePiva("el123456789", "GR")).toBe("123456789");
    expect(normalizePiva("DE811569869", "DE")).toBe("811569869");
  });
});

describe("isValidPivaIT", () => {
  it("accetta P.IVA reali", () => {
    expect(isValidPivaIT("00159560366")).toBe(true); // Ferrari S.p.A.
    expect(isValidPivaIT("00488410010")).toBe(true); // TIM S.p.A.
  });

  it("rifiuta checksum errati e formati sbagliati", () => {
    expect(isValidPivaIT("00159560367")).toBe(false);
    expect(isValidPivaIT("12345678901")).toBe(false);
    expect(isValidPivaIT("0015956036")).toBe(false);
    expect(isValidPivaIT("0015956036A")).toBe(false);
  });
});

describe("isValidCodiceFiscale", () => {
  it("accetta codici di persone fisiche e società", () => {
    expect(isValidCodiceFiscale("RSSMRA85T10A562S")).toBe(true);
    expect(isValidCodiceFiscale("rssmra85t10a562s")).toBe(true);
    expect(isValidCodiceFiscale("00159560366")).toBe(true);
  });

  it("accetta i codici con omocodia", () => {
    // Stesso codice con l'ultima cifra numerica sostituita (2 → N) e controllo ricalcolato.
    expect(isValidCodiceFiscale("RSSMRA85T10A56NH")).toBe(true);
  });

  it("rifiuta carattere di controllo errato o formato sbagliato", () => {
    expect(isValidCodiceFiscale("RSSMRA85T10A562T")).toBe(false);
    expect(isValidCodiceFiscale("RSSMRA85T10A562")).toBe(false);
    expect(isValidCodiceFiscale("RSSMRA85Z10A562S")).toBe(false);
  });
});
