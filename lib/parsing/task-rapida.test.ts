import { describe, expect, it } from "vitest";

import {
  inserisciRiferimento,
  parseTaskRapida,
  riferimentoInScrittura,
  slugRiferimento,
  suggerisciRiferimenti,
  type RiferimentoRapido,
} from "./task-rapida";

// Giovedì 24 settembre 2026.
const oggi = "2026-09-24";

const onis: RiferimentoRapido = { tipo: "cliente", id: "c1", nome: "Onis", alias: ["Onis S.r.l."] };
const rossi: RiferimentoRapido = { tipo: "cliente", id: "c2", nome: "Studio Rossi", alias: ["Studio Rossi & C. S.a.s."] };
const sitoRossi: RiferimentoRapido = {
  tipo: "progetto", id: "p1", nome: "Sito Rossi", clienteId: "c2", ambito: "lavoro",
};
const omonimo: RiferimentoRapido = { tipo: "progetto", id: "p2", nome: "Onis", clienteId: null, ambito: "personale" };
const riferimenti = [onis, rossi, sitoRossi];

function parse(testo: string, refs = riferimenti) {
  return parseTaskRapida(testo, { oggi, riferimenti: refs });
}

describe("parseTaskRapida", () => {
  it("riconosce l'esempio della spec", () => {
    expect(parse("Chiamare fornitore domani #onis !alta")).toEqual({
      titolo: "Chiamare fornitore",
      dataPianificata: "2026-09-25",
      scadenza: null,
      priorita: 1,
      progetto: null,
      cliente: onis,
      nonTrovati: [],
    });
  });

  it("lascia intatto un testo senza marcatori", () => {
    const r = parse("Rispondere a Marco");
    expect(r.titolo).toBe("Rispondere a Marco");
    expect(r.dataPianificata).toBeNull();
    expect(r.priorita).toBeNull();
  });

  it.each([
    ["oggi", "2026-09-24"],
    ["domani", "2026-09-25"],
    ["dopodomani", "2026-09-26"],
    ["Domani", "2026-09-25"],
  ])("data relativa %s", (parola, atteso) => {
    expect(parse(`Task ${parola}`).dataPianificata).toBe(atteso);
  });

  it.each([
    ["lun", "2026-09-28"],
    ["lunedì", "2026-09-28"],
    ["lunedi", "2026-09-28"],
    ["mer", "2026-09-30"],
    ["ven", "2026-09-25"],
    ["venerdì", "2026-09-25"],
    ["sabato", "2026-09-26"],
    ["dom", "2026-09-27"],
    // Oggi è giovedì: "giovedì" è quello della settimana prossima.
    ["gio", "2026-10-01"],
    ["giovedì", "2026-10-01"],
  ])("giorno della settimana %s", (parola, atteso) => {
    expect(parse(`Task ${parola}`).dataPianificata).toBe(atteso);
  });

  it("tra N giorni e settimane", () => {
    expect(parse("Task tra 3 giorni").dataPianificata).toBe("2026-09-27");
    expect(parse("Task fra 1 giorno").dataPianificata).toBe("2026-09-25");
    expect(parse("Task tra 2 settimane").dataPianificata).toBe("2026-10-08");
    expect(parse("Task tra poco").titolo).toBe("Task tra poco");
  });

  it("dd/mm nel futuro resta quest'anno, nel passato va all'anno prossimo", () => {
    expect(parse("Task 12/10").dataPianificata).toBe("2026-10-12");
    expect(parse("Task 24/09").dataPianificata).toBe("2026-09-24");
    expect(parse("Task 3/2").dataPianificata).toBe("2027-02-03");
  });

  it("dd/mm/yyyy e dd/mm/yy", () => {
    expect(parse("Task 05/01/2027").dataPianificata).toBe("2027-01-05");
    expect(parse("Task 05/01/28").dataPianificata).toBe("2028-01-05");
  });

  it("una data impossibile resta nel titolo", () => {
    const r = parse("Task 31/02");
    expect(r.dataPianificata).toBeNull();
    expect(r.titolo).toBe("Task 31/02");
    expect(parse("Task 29/02").dataPianificata).toBeNull();
    expect(parse("Task 29/02/2028").dataPianificata).toBe("2028-02-29");
  });

  it("entro <data> imposta la scadenza", () => {
    const r = parse("Consegnare bozza entro ven");
    expect(r).toMatchObject({ titolo: "Consegnare bozza", scadenza: "2026-09-25", dataPianificata: null });
    expect(parse("Consegnare entro il 12/10").scadenza).toBe("2026-10-12");
  });

  it("pianificata e scadenza nella stessa frase", () => {
    const r = parse("Preparare preventivo domani entro lunedì #sito-rossi");
    expect(r).toMatchObject({
      titolo: "Preparare preventivo",
      dataPianificata: "2026-09-25",
      scadenza: "2026-09-28",
      progetto: sitoRossi,
    });
  });

  it("toglie 'per' e 'il' davanti alla data", () => {
    expect(parse("Comprare pane per domani").titolo).toBe("Comprare pane");
    expect(parse("Riunione il 12/10").titolo).toBe("Riunione");
    expect(parse("Regalo per Anna").titolo).toBe("Regalo per Anna");
  });

  it("'entro' senza data resta nel titolo", () => {
    expect(parse("Finire entro stasera").titolo).toBe("Finire entro stasera");
  });

  it.each([
    ["!alta", 1], ["!media", 2], ["!bassa", 3], ["!1", 1], ["!2", 2], ["!3", 3], ["!ALTA", 1],
  ])("priorità %s", (marcatore, atteso) => {
    expect(parse(`Task ${marcatore}`).priorita).toBe(atteso);
  });

  it("una priorità sconosciuta resta nel titolo", () => {
    const r = parse("Task !urgente");
    expect(r.priorita).toBeNull();
    expect(r.titolo).toBe("Task !urgente");
  });

  it("#nome trova clienti per nome breve o ragione sociale, senza maiuscole né accenti", () => {
    expect(parse("Task #ONIS").cliente).toBe(onis);
    expect(parse("Task #onis-srl").cliente).toBe(onis);
    expect(parse("Task #studio-rossi-c-sas").cliente).toBe(rossi);
  });

  it("#nome di un progetto", () => {
    const r = parse("Task #sito-rossi");
    expect(r.progetto).toBe(sitoRossi);
    expect(r.cliente).toBeNull();
  });

  it("a parità di nome vince il progetto", () => {
    expect(parse("Task #onis", [onis, omonimo]).progetto).toBe(omonimo);
  });

  it("progetto e cliente insieme", () => {
    const r = parse("Task #sito-rossi #onis");
    expect(r.progetto).toBe(sitoRossi);
    expect(r.cliente).toBe(onis);
  });

  it("un #nome sconosciuto resta nel titolo ed è segnalato", () => {
    const r = parse("Task #boh, domani");
    expect(r.titolo).toBe("Task #boh,");
    expect(r.nonTrovati).toEqual(["#boh"]);
    expect(r.dataPianificata).toBe("2026-09-25");
  });

  it("i marcatori possono stare ovunque e la punteggiatura finale non conta", () => {
    const r = parse("!2 domani, Fatturare #onis.");
    expect(r).toMatchObject({ titolo: "Fatturare", priorita: 2, dataPianificata: "2026-09-25", cliente: onis });
  });

  it("titolo vuoto se ci sono solo marcatori", () => {
    expect(parse("domani !alta").titolo).toBe("");
  });

  it("gli spazi multipli si compattano", () => {
    expect(parse("  Chiamare    Luca  ").titolo).toBe("Chiamare Luca");
  });
});

describe("slugRiferimento", () => {
  it("normalizza i nomi", () => {
    expect(slugRiferimento("Sito Rossi & C.")).toBe("sito-rossi-c");
    expect(slugRiferimento("Caffè Città")).toBe("caffe-citta");
  });
});

describe("autocompletamento", () => {
  it("trova il #nome sotto il cursore", () => {
    expect(riferimentoInScrittura("Task #sit", 9)).toEqual({ query: "sit", inizio: 5, fine: 9 });
    expect(riferimentoInScrittura("Task #", 6)).toEqual({ query: "", inizio: 5, fine: 6 });
    expect(riferimentoInScrittura("Task #si domani", 7)).toEqual({ query: "si", inizio: 5, fine: 8 });
    expect(riferimentoInScrittura("Task domani", 11)).toBeNull();
    expect(riferimentoInScrittura("Task#x", 6)).toBeNull();
  });

  it("suggerisce prima chi inizia con il testo, poi chi lo contiene", () => {
    expect(suggerisciRiferimenti("ros", riferimenti)).toEqual([rossi, sitoRossi]);
    expect(suggerisciRiferimenti("s", riferimenti)).toEqual([rossi, sitoRossi, onis]);
    expect(suggerisciRiferimenti("", riferimenti)).toEqual(riferimenti);
    expect(suggerisciRiferimenti("rossi", riferimenti)).toEqual([rossi, sitoRossi]);
  });

  it("inserisce il riferimento scelto", () => {
    expect(inserisciRiferimento("Task #si domani", { inizio: 5, fine: 8 }, sitoRossi)).toEqual({
      testo: "Task #sito-rossi domani",
      cursore: 17,
    });
  });
});
