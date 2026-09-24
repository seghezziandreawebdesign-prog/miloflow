import { describe, expect, it } from "vitest";

import { hostDelSito, iniziali, nomeCliente, normalizeUrl } from "./clienti";

describe("iniziali", () => {
  it.each([
    ["Studio Rossi & C.", "SR"],
    ["FERRARI S.P.A.", "FS"],
    ["Onis", "ON"],
    ["  ", "?"],
    ["Àlfa beta", "ÀB"],
  ])("%s → %s", (nome, atteso) => {
    expect(iniziali(nome)).toBe(atteso);
  });
});

describe("nomeCliente", () => {
  it("preferisce il nome breve", () => {
    expect(nomeCliente({ nome_breve: "Onis", ragione_sociale: "Onis S.r.l." })).toBe("Onis");
    expect(nomeCliente({ nome_breve: " ", ragione_sociale: "Onis S.r.l." })).toBe("Onis S.r.l.");
  });
});

describe("url", () => {
  it("aggiunge il protocollo e ricava il dominio", () => {
    expect(normalizeUrl("onis.it")).toBe("https://onis.it");
    expect(normalizeUrl("http://onis.it")).toBe("http://onis.it");
    expect(normalizeUrl("  ")).toBeNull();
    expect(hostDelSito("www.onis.it/chi-siamo")).toBe("www.onis.it");
    expect(hostDelSito(null)).toBeNull();
    expect(hostDelSito("non valido con spazi")).toBeNull();
  });
});
