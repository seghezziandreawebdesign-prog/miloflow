import { describe, expect, it } from "vitest";

import { localDateTime } from "./format";
import {
  descriviRicorrenza,
  fromRRule,
  occorrenzeEvento,
  presetRicorrenza,
  prossimaOccorrenza,
  prossimeDateTask,
  toRRule,
} from "./ricorrenza";

describe("toRRule / fromRRule", () => {
  it("andata e ritorno", () => {
    const casi = [
      { frequenza: "giornaliera", intervallo: 1, giorni: [] },
      { frequenza: "giornaliera", intervallo: 3, giorni: [] },
      { frequenza: "settimanale", intervallo: 1, giorni: [0, 3] },
      { frequenza: "settimanale", intervallo: 2, giorni: [] },
      { frequenza: "mensile", intervallo: 1, giorni: [] },
      { frequenza: "annuale", intervallo: 1, giorni: [] },
    ] as const;
    for (const c of casi) {
      expect(fromRRule(toRRule({ ...c, giorni: [...c.giorni] }))).toEqual(c);
    }
  });

  it("stringhe attese", () => {
    expect(toRRule({ frequenza: "settimanale", intervallo: 1, giorni: [3, 0] })).toBe("FREQ=WEEKLY;BYDAY=MO,TH");
    expect(toRRule({ frequenza: "giornaliera", intervallo: 1, giorni: [] })).toBe("FREQ=DAILY");
    expect(toRRule({ frequenza: "mensile", intervallo: 2, giorni: [] })).toBe("FREQ=MONTHLY;INTERVAL=2");
  });

  it("rifiuta stringhe non valide", () => {
    expect(fromRRule("boh")).toBeNull();
    expect(fromRRule("")).toBeNull();
    expect(fromRRule(null)).toBeNull();
  });
});

describe("descriviRicorrenza", () => {
  it.each([
    ["FREQ=DAILY", "Ogni giorno"],
    ["FREQ=DAILY;INTERVAL=2", "Ogni 2 giorni"],
    ["FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR", "Giorni feriali"],
    ["FREQ=WEEKLY;BYDAY=MO", "Ogni settimana: lunedì"],
    ["FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE,TH", "Ogni 2 settimane: lunedì, mercoledì e giovedì"],
    ["FREQ=WEEKLY", "Ogni settimana"],
    ["FREQ=MONTHLY", "Ogni mese"],
    ["FREQ=MONTHLY;INTERVAL=3", "Ogni 3 mesi"],
    ["FREQ=YEARLY", "Ogni anno"],
  ])("%s", (rrule, atteso) => {
    expect(descriviRicorrenza(rrule)).toBe(atteso);
  });
});

describe("presetRicorrenza", () => {
  it("usa il giorno della data", () => {
    const preset = presetRicorrenza("2026-09-24");
    expect(preset.map((p) => p.label)).toContain("Ogni settimana (giovedì)");
    expect(preset.map((p) => p.label)).toContain("Ogni mese (giorno 24)");
    expect(preset.find((p) => p.label.startsWith("Ogni settimana"))?.value).toBe("FREQ=WEEKLY;BYDAY=TH");
  });
});

describe("prossimaOccorrenza", () => {
  it("completata in tempo: la successiva", () => {
    // Lunedì 28/09/2026
    expect(prossimaOccorrenza("FREQ=WEEKLY;BYDAY=MO", "2026-09-28", "2026-09-28")).toBe("2026-10-05");
    expect(prossimaOccorrenza("FREQ=DAILY", "2026-09-24", "2026-09-24")).toBe("2026-09-25");
  });

  it("completata in anticipo: resta sul calendario", () => {
    expect(prossimaOccorrenza("FREQ=WEEKLY;BYDAY=MO", "2026-10-05", "2026-09-30")).toBe("2026-10-12");
  });

  it("completata in ritardo: salta le occorrenze passate", () => {
    // Prevista lunedì 07/09, completata giovedì 24/09 → lunedì 28/09.
    expect(prossimaOccorrenza("FREQ=WEEKLY;BYDAY=MO", "2026-09-07", "2026-09-24")).toBe("2026-09-28");
    // Giornaliera in ritardo di giorni → oggi.
    expect(prossimaOccorrenza("FREQ=DAILY", "2026-09-20", "2026-09-24")).toBe("2026-09-24");
  });

  it("mantiene il passo dell'intervallo", () => {
    // Ogni 2 settimane dal 07/09: 21/09, 05/10…
    expect(prossimaOccorrenza("FREQ=WEEKLY;INTERVAL=2", "2026-09-07", "2026-09-24")).toBe("2026-10-05");
  });

  it("mensile e annuale", () => {
    expect(prossimaOccorrenza("FREQ=MONTHLY", "2026-09-15", "2026-09-15")).toBe("2026-10-15");
    expect(prossimaOccorrenza("FREQ=YEARLY", "2026-03-01", "2026-03-01")).toBe("2027-03-01");
  });

  it("giorni feriali: dal venerdì al lunedì", () => {
    expect(prossimaOccorrenza("FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR", "2026-09-25", "2026-09-25")).toBe("2026-09-28");
  });
});

describe("prossimeDateTask", () => {
  const oggi = "2026-09-24";

  it("sposta pianificata e scadenza mantenendo la distanza", () => {
    expect(
      prossimeDateTask({ ricorrenza: "FREQ=WEEKLY", data_pianificata: "2026-09-24", scadenza: "2026-09-26" }, oggi),
    ).toEqual({ data_pianificata: "2026-10-01", scadenza: "2026-10-03" });
  });

  it("solo scadenza", () => {
    expect(prossimeDateTask({ ricorrenza: "FREQ=MONTHLY", data_pianificata: null, scadenza: "2026-09-30" }, oggi)).toEqual({
      data_pianificata: null,
      scadenza: "2026-10-30",
    });
  });

  it("senza ricorrenza o con ricorrenza non valida", () => {
    expect(prossimeDateTask({ ricorrenza: null, data_pianificata: oggi, scadenza: null }, oggi)).toBeNull();
    expect(prossimeDateTask({ ricorrenza: "xyz", data_pianificata: oggi, scadenza: null }, oggi)).toBeNull();
  });
});

describe("occorrenzeEvento", () => {
  it("espande un evento settimanale nel giorno richiesto", () => {
    // Ogni giovedì alle 9:30 dal 03/09/2026.
    expect(occorrenzeEvento("FREQ=WEEKLY", "2026-09-03T09:30", "2026-09-24", "2026-09-24")).toEqual(["2026-09-24T09:30"]);
    expect(occorrenzeEvento("FREQ=WEEKLY", "2026-09-03T09:30", "2026-09-25", "2026-09-25")).toEqual([]);
  });

  it("l'inizio è la prima occorrenza anche se non corrisponde alla regola", () => {
    // Inizio martedì, regola "ogni lunedì".
    expect(occorrenzeEvento("FREQ=WEEKLY;BYDAY=MO", "2026-09-22T10:00", "2026-09-22", "2026-09-28")).toEqual([
      "2026-09-22T10:00",
      "2026-09-28T10:00",
    ]);
  });
});

describe("localDateTime", () => {
  it("converte in ora di Roma, anche col cambio d'ora", () => {
    expect(localDateTime("2026-09-24T07:30:00Z")).toBe("2026-09-24T09:30");
    expect(localDateTime("2026-12-31T23:30:00Z")).toBe("2027-01-01T00:30");
  });
});
