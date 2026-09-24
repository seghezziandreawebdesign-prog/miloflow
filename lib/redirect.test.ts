import { describe, expect, it } from "vitest";

import { safeNextPath } from "./redirect";

describe("safeNextPath", () => {
  it("accetta percorsi interni", () => {
    expect(safeNextPath("/servizi?apri=x")).toBe("/servizi?apri=x");
  });

  it.each([null, "", "https://evil.com", "//evil.com", "/\\evil.com", "oggi"])("rifiuta %s", (v) => {
    expect(safeNextPath(v)).toBe("/oggi");
  });
});
