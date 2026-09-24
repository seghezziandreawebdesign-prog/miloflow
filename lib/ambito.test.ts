import { describe, expect, it } from "vitest";

import { ambitoDiDefault, parseFiltroAmbito } from "./ambito";

describe("ambito", () => {
  it("usa 'tutto' per valori mancanti o non validi", () => {
    expect(parseFiltroAmbito(undefined)).toBe("tutto");
    expect(parseFiltroAmbito("boh")).toBe("tutto");
    expect(parseFiltroAmbito("personale")).toBe("personale");
  });

  it("crea in lavoro quando il filtro è 'tutto'", () => {
    expect(ambitoDiDefault("tutto")).toBe("lavoro");
    expect(ambitoDiDefault("personale")).toBe("personale");
  });
});
