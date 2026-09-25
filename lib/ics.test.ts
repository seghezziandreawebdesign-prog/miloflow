import { describe, expect, it } from "vitest";

import { eventiDaIcs, righeIcs, zonedToUtc } from "./ics";

const dal = new Date("2026-09-01T00:00:00Z");
const al = new Date("2026-12-31T23:59:59Z");

function ics(corpo: string): string {
  return ["BEGIN:VCALENDAR", "VERSION:2.0", corpo.trim(), "END:VCALENDAR"].join("\r\n");
}

describe("zonedToUtc", () => {
  it("converte l'ora di Roma in UTC con l'ora legale e senza", () => {
    // Settembre: UTC+2. Gennaio: UTC+1.
    expect(zonedToUtc(Date.UTC(2026, 8, 25, 10, 0, 0), "Europe/Rome").toISOString()).toBe("2026-09-25T08:00:00.000Z");
    expect(zonedToUtc(Date.UTC(2026, 0, 15, 10, 0, 0), "Europe/Rome").toISOString()).toBe("2026-01-15T09:00:00.000Z");
  });
});

describe("righeIcs", () => {
  it("riunisce le righe piegate", () => {
    expect(righeIcs("SUMMARY:Cena di\r\n  famiglia\r\nUID:x")).toEqual(["SUMMARY:Cena di famiglia", "UID:x"]);
  });
});

describe("eventiDaIcs", () => {
  it("legge un evento con TZID, titolo con escape e luogo", () => {
    const out = eventiDaIcs(
      ics(`
BEGIN:VEVENT
UID:e1
SUMMARY:Pranzo\\, tutti insieme
LOCATION:Casa dei nonni
DTSTART;TZID=Europe/Rome:20260925T123000
DTEND;TZID=Europe/Rome:20260925T143000
END:VEVENT`),
      dal,
      al,
    );
    expect(out).toEqual([
      {
        uid: "e1",
        titolo: "Pranzo, tutti insieme",
        inizio: "2026-09-25T10:30:00.000Z",
        fine: "2026-09-25T12:30:00.000Z",
        tutto_il_giorno: false,
        luogo: "Casa dei nonni",
        note: null,
      },
    ]);
  });

  it("un evento a giornata intera parte a mezzanotte di Roma e dura fino al DTEND escluso", () => {
    const out = eventiDaIcs(
      ics(`
BEGIN:VEVENT
UID:e2
SUMMARY:Ponte
DTSTART;VALUE=DATE:20261205
DTEND;VALUE=DATE:20261208
END:VEVENT`),
      dal,
      al,
    );
    expect(out[0]).toMatchObject({
      tutto_il_giorno: true,
      inizio: "2026-12-04T23:00:00.000Z",
      fine: "2026-12-07T23:00:00.000Z",
    });
  });

  it("un istante con la Z resta in UTC e senza DTEND la fine è nulla", () => {
    const out = eventiDaIcs(ics("BEGIN:VEVENT\r\nUID:e3\r\nSUMMARY:Call\r\nDTSTART:20261001T090000Z\r\nEND:VEVENT"), dal, al);
    expect(out[0]).toMatchObject({ inizio: "2026-10-01T09:00:00.000Z", fine: null });
  });

  it("scarta gli eventi fuori dall'intervallo e quelli cancellati", () => {
    const out = eventiDaIcs(
      ics(`
BEGIN:VEVENT
UID:vecchio
SUMMARY:Passato
DTSTART:20250101T100000Z
END:VEVENT
BEGIN:VEVENT
UID:annullato
SUMMARY:Annullato
STATUS:CANCELLED
DTSTART:20261001T100000Z
END:VEVENT`),
      dal,
      al,
    );
    expect(out).toEqual([]);
  });

  it("espande una ricorrenza settimanale saltando le EXDATE", () => {
    const out = eventiDaIcs(
      ics(`
BEGIN:VEVENT
UID:r1
SUMMARY:Nuoto
DTSTART;TZID=Europe/Rome:20260907T180000
DTEND;TZID=Europe/Rome:20260907T190000
RRULE:FREQ=WEEKLY;BYDAY=MO
EXDATE;TZID=Europe/Rome:20260921T180000
END:VEVENT`),
      new Date("2026-09-01T00:00:00Z"),
      new Date("2026-09-30T23:59:59Z"),
    );
    // Lunedì 7, 14, 28 settembre (il 21 è esclusa).
    expect(out.map((e) => e.inizio)).toEqual([
      "2026-09-07T16:00:00.000Z",
      "2026-09-14T16:00:00.000Z",
      "2026-09-28T16:00:00.000Z",
    ]);
    expect(new Set(out.map((e) => e.uid)).size).toBe(3);
  });

  it("un'occorrenza spostata (RECURRENCE-ID) sostituisce quella della regola", () => {
    const out = eventiDaIcs(
      ics(`
BEGIN:VEVENT
UID:r2
SUMMARY:Cena
DTSTART;TZID=Europe/Rome:20260904T200000
RRULE:FREQ=WEEKLY;BYDAY=FR;COUNT=2
END:VEVENT
BEGIN:VEVENT
UID:r2
SUMMARY:Cena (anticipata)
RECURRENCE-ID;TZID=Europe/Rome:20260911T200000
DTSTART;TZID=Europe/Rome:20260910T193000
END:VEVENT`),
      new Date("2026-09-01T00:00:00Z"),
      new Date("2026-09-30T23:59:59Z"),
    );
    const inizi = out.map((e) => `${e.titolo} ${e.inizio}`).sort();
    expect(inizi).toEqual([
      "Cena (anticipata) 2026-09-10T17:30:00.000Z",
      "Cena 2026-09-04T18:00:00.000Z",
    ]);
  });
});
