import { describe, expect, it } from "vitest";

import { formatCurrency, formatDate, formatLongDate, todayISO } from "./format";

describe("format", () => {
  it("formatta le date in dd/MM/yyyy senza slittamenti di fuso", () => {
    expect(formatDate("2026-01-01")).toBe("01/01/2026");
    expect(formatDate("2026-12-31")).toBe("31/12/2026");
  });

  it("usa i nomi italiani", () => {
    expect(formatLongDate("2026-09-24")).toBe("giovedì 24 settembre");
  });

  it("formatta gli euro in it-IT", () => {
    expect(formatCurrency(1234.5)).toBe("1234,50 €");
    expect(formatCurrency(12345.5)).toBe("12.345,50 €");
  });

  it("calcola oggi nel fuso di Roma", () => {
    // 23:30 UTC del 31/12 è già 1 gennaio a Roma.
    expect(todayISO(new Date("2025-12-31T23:30:00Z"))).toBe("2026-01-01");
  });
});
