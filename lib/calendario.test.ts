import { describe, expect, it } from "vitest";

import { coloriEvento, eventiPerCalendario, riferimentoEvento, TUTTI_I_TIPI, type RigaCalendario } from "./calendario";

const riga = (over: Partial<RigaCalendario>): RigaCalendario => ({
  id: "11111111-1111-4111-8111-111111111111",
  tipo: "task",
  titolo: "Chiamare fornitore",
  inizio: "2026-09-23T22:00:00Z", // mezzanotte di Roma del 24
  fine: null,
  tutto_il_giorno: true,
  ambito: "lavoro",
  cliente_id: null,
  progetto_id: null,
  colore: null,
  modificabile: true,
  ricorrenza: null,
  ...over,
});

const tutti = new Set(TUTTI_I_TIPI);

describe("eventiPerCalendario", () => {
  it("una task senza orario è di tutto il giorno, nel giorno di Roma", () => {
    const [e] = eventiPerCalendario([riga({})], tutti, "2026-09-21", "2026-09-27");
    expect(e.id).toBe("task:11111111-1111-4111-8111-111111111111");
    expect(e.start).toBe("2026-09-24");
    expect(e.allDay).toBe(true);
    expect(e.editable).toBe(true);
    expect(e.durationEditable).toBe(false);
  });

  it("una task con orario ha inizio, fine e si può allungare", () => {
    const [e] = eventiPerCalendario(
      [riga({ inizio: "2026-09-24T07:30:00Z", fine: "2026-09-24T09:00:00Z", tutto_il_giorno: false, colore: "#ea580c" })],
      tutti,
      "2026-09-21",
      "2026-09-27",
    );
    expect(e.start).toBe("2026-09-24T07:30:00Z");
    expect(e.end).toBe("2026-09-24T09:00:00Z");
    expect(e.allDay).toBe(false);
    expect(e.durationEditable).toBe(true);
    expect(e.borderColor).toBe("#ea580c");
  });

  it("filtra per tipo e non rende trascinabili le scadenze", () => {
    const righe = [
      riga({ tipo: "scadenza_servizio", titolo: "Dominio", modificabile: false }),
      riga({ tipo: "deadline", titolo: "Consegna", modificabile: false }),
    ];
    expect(eventiPerCalendario(righe, new Set(["deadline"]), "2026-09-21", "2026-09-27")).toHaveLength(1);
    const [scadenza] = eventiPerCalendario(righe, new Set(["scadenza_servizio"]), "2026-09-21", "2026-09-27");
    expect(scadenza.editable).toBe(false);
    const [deadline] = eventiPerCalendario(righe, new Set(["deadline"]), "2026-09-21", "2026-09-27");
    expect(deadline.title).toBe("Entro: Consegna");
  });

  it("espande le ricorrenze degli eventi nell'intervallo, senza trascinamento", () => {
    const righe = [
      riga({
        tipo: "evento",
        titolo: "Call settimanale",
        inizio: "2026-09-03T07:30:00Z",
        fine: "2026-09-03T08:00:00Z",
        tutto_il_giorno: false,
        ricorrenza: "FREQ=WEEKLY",
      }),
    ];
    const eventi = eventiPerCalendario(righe, tutti, "2026-09-21", "2026-09-27");
    expect(eventi.map((e) => e.start)).toEqual(["2026-09-24T07:30:00.000Z"]);
    expect(eventi[0].end).toBe("2026-09-24T08:00:00.000Z");
    expect(eventi[0].editable).toBe(false);
    expect(eventi[0].extendedProps.ricorrente).toBe(true);
    expect(eventi[0].id).toBe("evento:11111111-1111-4111-8111-111111111111:2026-09-24");
  });

  it("un evento di più giorni a giornata intera tiene la fine esclusiva", () => {
    const [e] = eventiPerCalendario(
      [riga({ tipo: "evento", titolo: "Ferie", inizio: "2026-09-21T22:00:00Z", fine: "2026-09-25T22:00:00Z" })],
      tutti,
      "2026-09-21",
      "2026-09-27",
    );
    expect(e.start).toBe("2026-09-22");
    expect(e.end).toBe("2026-09-26");
  });
});

describe("coloriEvento", () => {
  it("gli eventi sono pieni, le task chiare, con il bordo del progetto", () => {
    expect(coloriEvento("evento", "personale", null).backgroundColor).toBe("#9b59d0");
    expect(coloriEvento("task", "lavoro", "#059669")).toEqual({
      backgroundColor: "#e6eefb",
      borderColor: "#059669",
      textColor: "#3a7bd5",
    });
    expect(coloriEvento("deadline", "lavoro", null).textColor).toBe("#ff3b30");
  });
});

describe("riferimentoEvento", () => {
  it("apre il pannello giusto", () => {
    expect(riferimentoEvento({ tipo: "deadline", id: "x" })).toEqual({ tipo: "task", id: "x" });
    expect(riferimentoEvento({ tipo: "scadenza_servizio", id: "x" })).toEqual({ tipo: "servizio", id: "x" });
    expect(riferimentoEvento({ tipo: "evento", id: "x" })).toEqual({ tipo: "evento", id: "x" });
  });
});
