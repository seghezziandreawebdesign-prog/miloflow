import { describe, expect, it } from "vitest";

import { componiDigest, escapeHtml } from "@/supabase/functions/_shared/digest";
import { adessoARoma } from "@/supabase/functions/_shared/resend";

const base = { servizi: [], task: [], rate: [], oggi: "2026-09-24", siteUrl: "https://miloflow.vercel.app/" };

describe("componiDigest", () => {
  it("non produce email vuote", () => {
    expect(componiDigest(base)).toBeNull();
  });

  it("elenca le scadenze con link al pannello, le più urgenti prima", () => {
    const d = componiDigest({
      ...base,
      servizi: [
        { id: "b", nome: "Hosting", prossima_scadenza: "2026-10-10", giorni: 16 },
        { id: "a", nome: "Dominio <test>", prossima_scadenza: "2026-09-20", giorni: -4 },
      ],
    });
    expect(d).not.toBeNull();
    expect(d!.oggetto).toBe("⚠️ Milo Flow · 2 scadenze");
    expect(d!.html).toContain("https://miloflow.vercel.app/servizi?apri=servizio:a");
    expect(d!.html).toContain("Dominio &lt;test&gt;");
    expect(d!.html.indexOf("Dominio")).toBeLessThan(d!.html.indexOf("Hosting"));
    expect(d!.testo).toContain("scaduto da 4 giorni");
  });

  it("include task in ritardo e rate", () => {
    const d = componiDigest({
      ...base,
      task: [{ id: "t", titolo: "Chiamare fornitore", scadenza: "2026-09-20", data_pianificata: null }],
      rate: [{ id: "r", debito_id: "d", creditore: "Banca", numero: 3, scadenza: "2026-09-28", importo: 150 }],
    });
    expect(d!.oggetto).toBe("Milo Flow · 1 task in ritardo, 1 rata");
    expect(d!.html).toContain("/task?apri=task:t");
    expect(d!.html).toContain("/budget?apri=debito:d");
    expect(d!.testo).toContain("150,00");
  });
});

describe("utility", () => {
  it("escapa l'HTML", () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe("&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;");
  });

  it("calcola data e ora di Roma, anche col cambio d'ora", () => {
    expect(adessoARoma(new Date("2026-09-24T05:30:00Z"))).toEqual({ data: "2026-09-24", ora: "07:30" });
    expect(adessoARoma(new Date("2026-12-31T23:30:00Z"))).toEqual({ data: "2027-01-01", ora: "00:30" });
  });
});
