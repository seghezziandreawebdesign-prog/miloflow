import { describe, expect, it } from "vitest";

import { costoAnnuo, parseImporto, scadenzaSuccessiva, scadenzeNelPeriodo } from "./servizi";

describe("scadenzaSuccessiva", () => {
  it.each([
    ["2027-01-31", "mensile", "2027-02-28"],
    ["2028-01-31", "mensile", "2028-02-29"],
    ["2026-11-30", "trimestrale", "2027-02-28"],
    ["2026-08-31", "semestrale", "2027-02-28"],
    ["2026-09-24", "annuale", "2027-09-24"],
    ["2028-02-29", "annuale", "2029-02-28"],
    ["2028-02-29", "biennale", "2030-02-28"],
    ["2026-12-15", "mensile", "2027-01-15"],
  ] as const)("%s %s → %s", (data, freq, attesa) => {
    expect(scadenzaSuccessiva(data, freq)).toBe(attesa);
  });

  it("non rinnova gli una tantum", () => {
    expect(scadenzaSuccessiva("2026-09-24", "una_tantum")).toBeNull();
  });
});

describe("scadenzeNelPeriodo", () => {
  it("elenca le scadenze mensili nei prossimi mesi", () => {
    expect(scadenzeNelPeriodo("2026-10-05", "mensile", "2026-10-01", "2027-01-31")).toEqual([
      "2026-10-05", "2026-11-05", "2026-12-05", "2027-01-05",
    ]);
  });

  it("include un annuale solo se cade nel periodo", () => {
    expect(scadenzeNelPeriodo("2027-03-01", "annuale", "2026-10-01", "2027-09-30")).toEqual(["2027-03-01"]);
    expect(scadenzeNelPeriodo("2028-03-01", "annuale", "2026-10-01", "2027-09-30")).toEqual([]);
  });
});

describe("costoAnnuo", () => {
  it("normalizza su 12 mesi", () => {
    expect(costoAnnuo(10, "mensile")).toBe(120);
    expect(costoAnnuo(30, "trimestrale")).toBe(120);
    expect(costoAnnuo(240, "biennale")).toBe(120);
    expect(costoAnnuo(99, "una_tantum")).toBe(0);
    expect(costoAnnuo(null, "annuale")).toBe(0);
  });
});

describe("parseImporto", () => {
  it.each([
    ["12,50", 12.5],
    ["1.234,50", 1234.5],
    ["1234.5", 1234.5],
    ["€ 9,99", 9.99],
    ["", null],
  ])("%s → %s", (input, atteso) => {
    expect(parseImporto(input)).toBe(atteso);
  });

  it("rifiuta testo non numerico", () => {
    expect(parseImporto("dieci")).toBeNaN();
    expect(parseImporto("1,234")).toBeNaN();
  });
});
