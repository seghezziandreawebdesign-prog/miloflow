import { describe, expect, it } from "vitest";

import {
  avanzamentoObiettivo,
  categoriaPredefinita,
  isIsin,
  mesiTra,
  rendimento,
  ritmoObiettivo,
  serieInvestimento,
  totaliSalvadanai,
} from "./salvadanai";

describe("salvadanai", () => {
  it("calcola l'avanzamento verso l'obiettivo", () => {
    expect(avanzamentoObiettivo(1250, 3000)).toBe(42);
    expect(avanzamentoObiettivo(3500, 3000)).toBe(100);
    expect(avanzamentoObiettivo(-10, 3000)).toBe(0);
    expect(avanzamentoObiettivo(100, null)).toBeNull();
  });

  it("conta i mesi fino alla data", () => {
    expect(mesiTra("2026-09-24", "2026-12-31")).toBe(3);
    expect(mesiTra("2026-09-24", "2027-01-05")).toBe(4);
    expect(mesiTra("2026-09-24", "2026-09-30")).toBe(0);
  });

  it("dice quanto versare al mese per arrivare in tempo", () => {
    const oggi = "2026-09-24";
    expect(ritmoObiettivo({ saldo: 1200, obiettivo: 3000, data_obiettivo: "2026-12-31" }, oggi)).toEqual({
      stato: "in_corso",
      mancano: 1800,
      mesi: 3,
      alMese: 600,
    });
    // Nello stesso mese resta un solo versamento; i centesimi si arrotondano per eccesso.
    expect(ritmoObiettivo({ saldo: 0, obiettivo: 100, data_obiettivo: "2026-09-30" }, oggi)).toMatchObject({ mesi: 1, alMese: 100 });
    expect(ritmoObiettivo({ saldo: 0, obiettivo: 100, data_obiettivo: "2026-12-01" }, oggi)).toMatchObject({ alMese: 33.34 });
    expect(ritmoObiettivo({ saldo: 3000, obiettivo: 3000, data_obiettivo: "2026-12-31" }, oggi)).toEqual({ stato: "raggiunto" });
    expect(ritmoObiettivo({ saldo: 500, obiettivo: 3000, data_obiettivo: "2026-08-31" }, oggi)).toEqual({ stato: "scaduto", mancano: 2500 });
    expect(ritmoObiettivo({ saldo: 500, obiettivo: 3000, data_obiettivo: null }, oggi)).toBeNull();
    expect(ritmoObiettivo({ saldo: 500, obiettivo: null, data_obiettivo: "2026-12-31" }, oggi)).toBeNull();
  });

  it("calcola il rendimento di un investimento", () => {
    expect(rendimento(4000, 4400)).toEqual({ euro: 400, percento: 10 });
    expect(rendimento(4000, 3900)).toEqual({ euro: -100, percento: -2.5 });
    expect(rendimento(0, 50)).toEqual({ euro: 50, percento: null });
    expect(rendimento(4000, null)).toBeNull();
  });

  it("costruisce la serie del grafico", () => {
    expect(
      serieInvestimento(
        [
          { data: "2026-07-05", importo: 400 },
          { data: "2026-08-05", importo: 400 },
        ],
        [{ data: "2026-08-20", importo: 100 }],
        [{ data: "2026-08-05", valore: 820 }],
      ),
    ).toEqual([
      { data: "2026-07-05", versato: 400, valore: null },
      { data: "2026-08-05", versato: 800, valore: 820 },
      { data: "2026-08-20", versato: 700, valore: null },
    ]);
  });

  it("somma i totali dei salvadanai attivi", () => {
    expect(
      totaliSalvadanai([
        { saldo: 1000, valore_attuale: 1100, archiviato: false },
        { saldo: 500, valore_attuale: null, archiviato: false },
        { saldo: 999, valore_attuale: 999, archiviato: true },
      ]),
    ).toEqual({ saldo: 1500, valore: 1600, rendimento: { euro: 100, percento: 6.7 } });
    expect(totaliSalvadanai([{ saldo: 300, valore_attuale: null, archiviato: false }])).toEqual({ saldo: 300, valore: null, rendimento: null });
  });

  it("propone la categoria dei versamenti", () => {
    const categorie = [
      { id: "p", nome: "Risparmi e investimenti", parent_id: null, archiviata: false },
      { id: "r", nome: "Risparmi", parent_id: "p", archiviata: false },
      { id: "i", nome: "Investimenti", parent_id: "p", archiviata: false },
      { id: "x", nome: "Investimenti", parent_id: null, archiviata: false },
    ];
    expect(categoriaPredefinita(categorie, "risparmio")).toBe("r");
    expect(categoriaPredefinita(categorie, "investimento")).toBe("i");
    expect(categoriaPredefinita(categorie.slice(3), "investimento")).toBe("x");
    expect(categoriaPredefinita([], "risparmio")).toBe("");
  });

  it("riconosce un ISIN", () => {
    expect(isIsin("IE00BK5BQT80")).toBe(true);
    expect(isIsin("ie00bk5bqt80")).toBe(false);
    expect(isIsin("IE00BK5BQT8")).toBe(false);
  });
});
