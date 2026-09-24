import { describe, expect, it } from "vitest";

import {
  abbonamentiAnnui,
  aggiungiMesi,
  aggiungiMesiData,
  alberoCategorie,
  andamentoResiduo,
  budgetDelMese,
  categorieScegliibili,
  fineDelMese,
  fisseVsVariabili,
  formatMese,
  formatMeseBreve,
  generaPianoRate,
  intervalloReport,
  marginePerCliente,
  nomeCategoria,
  primoDelMese,
  riepilogoDebiti,
  spesaPerCategoria,
  spesaPerMese,
  spesaPerMetodo,
  statoDebito,
  totaliMese,
  ultimiMesi,
  type Categoria,
  type MovimentoBase,
} from "./budget";

const cat = (c: Partial<Categoria> & { id: string; nome: string }): Categoria => ({
  parent_id: null,
  ambito: "entrambi",
  colore: null,
  icona: null,
  budget_default: null,
  ordine: 0,
  archiviata: false,
  ...c,
});

const categorie: Categoria[] = [
  cat({ id: "sw", nome: "Software", ambito: "lavoro", colore: "#00f", budget_default: 100, ordine: 10 }),
  cat({ id: "host", nome: "Hosting", parent_id: "sw", ambito: "lavoro", budget_default: 40, ordine: 1 }),
  cat({ id: "dom", nome: "Domini", parent_id: "sw", ambito: "lavoro", ordine: 2 }),
  cat({ id: "casa", nome: "Casa", ambito: "personale", colore: "#f00", ordine: 20 }),
  cat({ id: "aff", nome: "Affitto", parent_id: "casa", ambito: "personale", budget_default: 700, ordine: 1 }),
  cat({ id: "old", nome: "Vecchia", ambito: "entrambi", archiviata: true, ordine: 30 }),
];

const mov = (m: Partial<MovimentoBase> & { id: string; importo: number }): MovimentoBase => ({
  ambito: "lavoro",
  data: "2026-09-10",
  stato: "pagato",
  categoria_id: null,
  servizio_id: null,
  rata_id: null,
  metodo_pagamento_id: null,
  ...m,
});

describe("mesi", () => {
  it("calcola primo, fine e mesi successivi", () => {
    expect(primoDelMese("2026-09-24")).toBe("2026-09-01");
    expect(fineDelMese("2026-02-01")).toBe("2026-02-28");
    expect(fineDelMese("2028-02-01")).toBe("2028-02-29");
    expect(aggiungiMesi("2026-12-01", 1)).toBe("2027-01-01");
    expect(aggiungiMesi("2026-01-01", -1)).toBe("2025-12-01");
    expect(aggiungiMesi("2026-01-01", -13)).toBe("2024-12-01");
    expect(ultimiMesi("2026-02-01", 3)).toEqual(["2025-12-01", "2026-01-01", "2026-02-01"]);
  });

  it("rispetta la fine mese aggiungendo mesi a una data", () => {
    expect(aggiungiMesiData("2026-01-31", 1)).toBe("2026-02-28");
    expect(aggiungiMesiData("2026-01-31", 2)).toBe("2026-03-31");
    expect(aggiungiMesiData("2026-11-30", 3)).toBe("2027-02-28");
  });

  it("formatta i mesi in italiano", () => {
    expect(formatMese("2026-09-01")).toBe("settembre 2026");
    expect(formatMeseBreve("2026-09-01")).toBe("set");
    expect(formatMeseBreve("2027-01-01")).toBe("gen 27");
  });

  it("calcola gli intervalli dei report", () => {
    expect(intervalloReport("mese", "2026-09-24")).toEqual({ dal: "2026-09-01", al: "2026-09-30" });
    expect(intervalloReport("3mesi", "2026-01-15")).toEqual({ dal: "2025-11-01", al: "2026-01-31" });
    expect(intervalloReport("12mesi", "2026-09-24")).toEqual({ dal: "2025-10-01", al: "2026-09-30" });
    expect(intervalloReport("anno", "2026-09-24")).toEqual({ dal: "2026-01-01", al: "2026-12-31" });
  });
});

describe("categorie", () => {
  it("costruisce l'albero ordinato", () => {
    const albero = alberoCategorie(categorie);
    expect(albero.map((r) => r.padre.nome)).toEqual(["Software", "Casa", "Vecchia"]);
    expect(albero[0].figlie.map((f) => f.nome)).toEqual(["Hosting", "Domini"]);
  });

  it("filtra per ambito ed esclude le archiviate", () => {
    expect(categorieScegliibili(categorie, "lavoro").map((r) => r.padre.nome)).toEqual(["Software"]);
    expect(categorieScegliibili(categorie, "personale").map((r) => r.padre.nome)).toEqual(["Casa"]);
    expect(categorieScegliibili(categorie, "tutto").map((r) => r.padre.nome)).toEqual(["Software", "Casa"]);
  });

  it("mette le orfane in fondo come padri", () => {
    const albero = alberoCategorie([cat({ id: "x", nome: "Orfana", parent_id: "manca" }), ...categorie]);
    expect(albero.at(-1)?.padre.nome).toBe("Orfana");
  });

  it("compone il nome con il padre", () => {
    expect(nomeCategoria("host", categorie)).toBe("Software › Hosting");
    expect(nomeCategoria("casa", categorie)).toBe("Casa");
    expect(nomeCategoria("no", categorie)).toBeNull();
  });

  it("calcola il budget del mese: override del padre, altrimenti default più figlie", () => {
    const ramo = alberoCategorie(categorie)[0];
    expect(budgetDelMese(ramo, new Map())).toEqual({ budget: 140, personalizzato: false });
    expect(budgetDelMese(ramo, new Map([["sw", 90]]))).toEqual({ budget: 90, personalizzato: true });
    expect(budgetDelMese(ramo, new Map([["host", 60]]))).toEqual({ budget: 160, personalizzato: true });
    expect(budgetDelMese(alberoCategorie(categorie)[2], new Map())).toEqual({ budget: null, personalizzato: false });
  });
});

describe("piano rate e debiti", () => {
  it("genera rate mensili uguali con il resto sull'ultima", () => {
    const piano = generaPianoRate({ totale: 100, numeroRate: 3, primaScadenza: "2026-01-31" });
    expect(piano).toEqual([
      { numero: 1, scadenza: "2026-01-31", importo: 33.33 },
      { numero: 2, scadenza: "2026-02-28", importo: 33.33 },
      { numero: 3, scadenza: "2026-03-31", importo: 33.34 },
    ]);
    expect(generaPianoRate({ totale: 50, numeroRate: 0, primaScadenza: "2026-05-05" })).toHaveLength(1);
  });

  it("calcola lo stato del debito", () => {
    const rate = [
      { numero: 1, scadenza: "2026-08-01", importo: 100, pagata: true },
      { numero: 2, scadenza: "2026-09-01", importo: 100, pagata: false },
      { numero: 3, scadenza: "2026-10-01", importo: 100, pagata: false },
    ];
    const s = statoDebito({ importo_totale: 300 }, rate, "2026-09-24");
    expect(s).toMatchObject({ pagato: 100, residuo: 200, ratePagate: 1, rateTotali: 3, inRitardo: 1, avanzamento: 33 });
    expect(s.prossima).toEqual({ numero: 2, scadenza: "2026-09-01", importo: 100 });
    expect(statoDebito({ importo_totale: 500 }, [], "2026-09-24")).toMatchObject({ residuo: 500, prossima: null, avanzamento: 0 });
  });

  it("calcola l'andamento del residuo", () => {
    const punti = andamentoResiduo({ importo_totale: 300 }, [
      { scadenza: "2026-10-01", importo: 100, pagata: false },
      { scadenza: "2026-09-01", importo: 100, pagata: true },
    ]);
    expect(punti.map((p) => p.residuo)).toEqual([100, 0]);
  });
});

describe("riepilogo debiti", () => {
  it("somma residui, rate pagate nel periodo e prossime rate", () => {
    const debiti = [
      {
        id: "d1",
        creditore: "Banca",
        importo_totale: 300,
        debiti_rate: [
          { numero: 1, scadenza: "2026-08-01", importo: 100, pagata: true },
          { numero: 2, scadenza: "2026-10-01", importo: 100, pagata: false },
          { numero: 3, scadenza: "2026-11-01", importo: 100, pagata: false },
        ],
      },
      { id: "d2", creditore: "Amico", importo_total: 0, importo_totale: 50, debiti_rate: [{ numero: 1, scadenza: "2026-09-30", importo: 50, pagata: false }] },
    ];
    const r = riepilogoDebiti(debiti, [mov({ id: "m", importo: 100, rata_id: "r1" }), mov({ id: "n", importo: 7 })], "2026-09-24", 2);
    expect(r.residuo).toBe(250);
    expect(r.pagate).toEqual({ numero: 1, totale: 100 });
    expect(r.prossime.map((p) => `${p.creditore}${p.numero}`)).toEqual(["Amico1", "Banca2"]);
    expect(r.perCreditore[0]).toMatchObject({ creditore: "Banca", residuo: 200, pagato: 100, avanzamento: 33 });
  });
});

describe("totali del mese", () => {
  const movimenti = [
    mov({ id: "1", importo: 30, categoria_id: "host", servizio_id: "s1" }),
    mov({ id: "2", importo: 25, categoria_id: "dom", stato: "previsto" }),
    mov({ id: "3", importo: 700, categoria_id: "aff", ambito: "personale", rata_id: "r1" }),
    mov({ id: "4", importo: 12, ambito: "personale" }),
    mov({ id: "5", importo: 5, categoria_id: "old" }),
  ];

  it("somma le figlie nel padre e rispetta l'ambito", () => {
    const t = totaliMese(movimenti, categorie, [], "tutto");
    expect(t.speso).toBe(747);
    expect(t.previsto).toBe(25);
    expect(t.budget).toBe(840);
    expect(t.rimanente).toBe(68);
    const sw = t.barre.find((b) => b.categoria?.id === "sw")!;
    expect(sw).toMatchObject({ budget: 140, speso: 30, previsto: 25, superato: false });
    expect(t.barre.find((b) => b.categoria === null)).toMatchObject({ speso: 12 });
    expect(t.barre.find((b) => b.categoria?.id === "old")).toMatchObject({ speso: 5, budget: null });
  });

  it("segna il superamento e usa l'override del mese", () => {
    const t = totaliMese(movimenti, categorie, [{ categoria_id: "sw", importo: 50 }], "lavoro");
    const sw = t.barre.find((b) => b.categoria?.id === "sw")!;
    expect(sw).toMatchObject({ budget: 50, personalizzato: true, superato: true });
    expect(t.barre[0]).toBe(sw);
    expect(t.barre.some((b) => b.categoria?.id === "casa")).toBe(false);
  });

  it("nasconde le categorie vuote senza budget", () => {
    const t = totaliMese([], categorie, [], "tutto");
    expect(t.barre.map((b) => b.categoria?.id)).toEqual(["sw", "casa"]);
  });
});

describe("report", () => {
  const movimenti = [
    mov({ id: "1", importo: 30, categoria_id: "host", servizio_id: "s1", data: "2026-09-10", metodo_pagamento_id: "m1" }),
    mov({ id: "2", importo: 25, categoria_id: "dom", stato: "previsto", data: "2026-09-20" }),
    mov({ id: "3", importo: 700, categoria_id: "aff", ambito: "personale", rata_id: "r1", data: "2026-08-01" }),
    mov({ id: "4", importo: 12, ambito: "personale", data: "2026-09-02" }),
  ];

  it("raggruppa per categoria padre solo i pagati", () => {
    expect(spesaPerCategoria(movimenti, categorie)).toEqual([
      { id: "casa", nome: "Casa", colore: "#f00", totale: 700 },
      { id: "sw", nome: "Software", colore: "#00f", totale: 30 },
      { id: null, nome: "Senza categoria", colore: null, totale: 12 },
    ]);
  });

  it("distribuisce per mese e ambito", () => {
    expect(spesaPerMese(movimenti, ["2026-08-01", "2026-09-01"])).toEqual([
      { mese: "2026-08-01", lavoro: 0, personale: 700 },
      { mese: "2026-09-01", lavoro: 30, personale: 12 },
    ]);
  });

  it("separa fisse e variabili", () => {
    expect(fisseVsVariabili(movimenti)).toEqual({ fisse: 730, variabili: 12 });
  });

  it("normalizza gli abbonamenti su 12 mesi", () => {
    const r = abbonamentiAnnui([
      { id: "a", nome: "Hosting", ambito: "lavoro", costo: 10, frequenza: "mensile" },
      { id: "b", nome: "Dominio", ambito: "lavoro", costo: 15, frequenza: "annuale" },
      { id: "c", nome: "Una tantum", ambito: "lavoro", costo: 99, frequenza: "una_tantum" },
    ]);
    expect(r.totale).toBe(135);
    expect(r.mensile).toBe(11.25);
    expect(r.elenco.map((s) => s.nome)).toEqual(["Hosting", "Dominio"]);
  });

  it("calcola il margine annuo per cliente", () => {
    const m = marginePerCliente([
      { cliente_id: "c1", cliente: "Acme", servizio: "Hosting", frequenza: "mensile", prezzo_rivendita: 20, costo: 10 },
      { cliente_id: "c1", cliente: "Acme", servizio: "Dominio", frequenza: "annuale", prezzo_rivendita: 30, costo: 12 },
      { cliente_id: "c2", cliente: "Beta", servizio: "Hosting", frequenza: "mensile", prezzo_rivendita: null, costo: 10 },
    ]);
    expect(m[0]).toEqual({ cliente_id: "c1", cliente: "Acme", rivendita: 270, costo: 132, margine: 138, servizi: 2 });
    expect(m[1]).toMatchObject({ cliente: "Beta", margine: -120 });
  });

  it("somma per metodo di pagamento", () => {
    expect(spesaPerMetodo(movimenti, [{ id: "m1", nome: "Revolut", ultime_cifre: "4417" }])).toEqual([
      { id: null, nome: "Non indicato", totale: 712, movimenti: 2 },
      { id: "m1", nome: "Revolut •4417", totale: 30, movimenti: 1 },
    ]);
  });
});
