import { describe, expect, it } from "vitest";

import { testoInHtml, testoSemplice } from "./testo-ricco";

describe("testoInHtml", () => {
  it("lascia com'è l'HTML dell'editor", () => {
    expect(testoInHtml("<p>Ciao <strong>tu</strong></p>")).toBe("<p>Ciao <strong>tu</strong></p>");
  });

  it("converte il testo semplice in paragrafi, con escape", () => {
    expect(testoInHtml("Riga 1\nRiga 2\n\nAltro <b>")).toBe("<p>Riga 1<br>Riga 2</p><p>Altro &lt;b&gt;</p>");
  });

  it("vuoto", () => {
    expect(testoInHtml(null)).toBe("");
    expect(testoInHtml("  ")).toBe("");
  });
});

describe("testoSemplice", () => {
  it("toglie i tag e decodifica le entità", () => {
    expect(testoSemplice("<h2>Titolo</h2><p>Uno &amp; due</p><ul><li><p>a</p></li><li><p>b</p></li></ul>")).toBe(
      "Titolo Uno & due a b",
    );
  });
});
