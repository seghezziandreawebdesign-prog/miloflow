import { describe, expect, it } from "vitest";

import { formatApri, parseApri } from "./entita";

const ID = "3f2b8c1e-9a4d-4e21-8b0f-1c2d3e4f5a6b";

describe("parseApri", () => {
  it("riconosce tipo e id", () => {
    expect(parseApri(`servizio:${ID}`)).toEqual({ tipo: "servizio", id: ID });
  });

  it("è l'inverso di formatApri", () => {
    expect(parseApri(formatApri({ tipo: "task", id: ID }))).toEqual({ tipo: "task", id: ID });
  });

  it.each([null, "", "servizio", `fattura:${ID}`, "servizio:non-un-uuid", `task:${ID}:extra`])(
    "rifiuta %s",
    (value) => {
      expect(parseApri(value)).toBeNull();
    },
  );
});
