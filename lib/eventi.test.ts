import { describe, expect, it } from "vitest";

import { eventiDelGiorno } from "./eventi";

const base = { tutto_il_giorno: false, ricorrenza: null, fine: null };

describe("eventiDelGiorno", () => {
  it("usa l'ora di Roma per decidere il giorno", () => {
    const eventi = [
      // 23:30 UTC del 23 = 01:30 del 24 a Roma (ora legale)
      { ...base, id: "a", titolo: "Notte", inizio: "2026-09-23T23:30:00Z" },
      { ...base, id: "b", titolo: "Ieri", inizio: "2026-09-23T10:00:00Z" },
      { ...base, id: "c", titolo: "Riunione", inizio: "2026-09-24T07:00:00Z", fine: "2026-09-24T08:00:00Z" },
    ];
    const r = eventiDelGiorno(eventi, "2026-09-24");
    expect(r.map((e) => [e.id, e.ora, e.oraFine])).toEqual([
      ["a", "01:30", null],
      ["c", "09:00", "10:00"],
    ]);
  });

  it("eventi di più giorni e di tutto il giorno", () => {
    const eventi = [
      { ...base, id: "ferie", titolo: "Ferie", inizio: "2026-09-22T22:00:00Z", fine: "2026-09-26T22:00:00Z", tutto_il_giorno: true },
      { ...base, id: "fiera", titolo: "Fiera", inizio: "2026-09-23T08:00:00Z", fine: "2026-09-25T16:00:00Z" },
    ];
    const r = eventiDelGiorno(eventi, "2026-09-24");
    expect(r.map((e) => [e.id, e.ora, e.oraFine])).toEqual([
      ["ferie", null, null],
      ["fiera", null, null],
    ]);
  });

  it("espande le ricorrenze", () => {
    const eventi = [
      { ...base, id: "call", titolo: "Call settimanale", inizio: "2026-09-03T07:30:00Z", ricorrenza: "FREQ=WEEKLY" },
      { ...base, id: "mensile", titolo: "Mensile", inizio: "2026-09-10T07:30:00Z", ricorrenza: "FREQ=MONTHLY" },
    ];
    const r = eventiDelGiorno(eventi, "2026-09-24");
    expect(r.map((e) => [e.id, e.ora])).toEqual([["call", "09:30"]]);
  });
});
