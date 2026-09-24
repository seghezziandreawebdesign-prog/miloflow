import { describe, expect, it } from "vitest";

import { formatDimensione, isImmagine, nomeFileSicuro, nomeScreenshot, nomeVisibile } from "./allegati";

describe("nomi dei file", () => {
  it("rende sicuro il nome e aggiunge un prefisso univoco", () => {
    const n = nomeFileSicuro("Preventivo città (v2).PDF", 1727000000000, 0.123456);
    expect(n).toMatch(/^1727000000000-[a-z0-9]{4}-Preventivo-citta-v2\.pdf$/);
    expect(nomeVisibile(n)).toBe("Preventivo-citta-v2.pdf");
  });

  it("nomi senza estensione o fatti solo di simboli", () => {
    expect(nomeVisibile(nomeFileSicuro("README", 1727000000000, 0.5))).toBe("README");
    expect(nomeVisibile(nomeFileSicuro("???.png", 1727000000000, 0.5))).toBe("file.png");
  });

  it("gli screenshot prendono data e ora", () => {
    expect(nomeScreenshot("image/png", new Date(2026, 8, 24, 9, 5, 7))).toBe("screenshot-2026-09-24-090507.png");
    expect(nomeScreenshot("image/jpeg", new Date(2026, 8, 24, 9, 5, 7))).toBe("screenshot-2026-09-24-090507.jpg");
  });
});

describe("tipi e dimensioni", () => {
  it("riconosce le immagini mostrabili", () => {
    expect(isImmagine("image/png")).toBe(true);
    expect(isImmagine("image/svg+xml")).toBe(false);
    expect(isImmagine("application/pdf")).toBe(false);
  });

  it("formatta le dimensioni", () => {
    expect(formatDimensione(512)).toBe("512 B");
    expect(formatDimensione(2048)).toBe("2 KB");
    expect(formatDimensione(1.5 * 1024 * 1024)).toBe("1,5 MB");
  });
});
