// Normalizzazione della risposta VIES. Senza dipendenze: la usano sia la
// Edge Function (Deno) sia i test (vitest).

export type DatiVies = {
  valida: boolean;
  ragioneSociale: string | null;
  indirizzo: string | null;
  cap: string | null;
  citta: string | null;
  provincia: string | null;
};

// VIES scrive "---" quando un dato non è disponibile.
function pulisci(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" || trimmed === "---" ? null : trimmed;
}

// "VIA EMILIA EST" → "Via Emilia Est"
export function titleCase(value: string): string {
  return value.toLowerCase().replace(/(^|[\s'’(/-])(\p{L})/gu, (_, sep: string, ch: string) => sep + ch.toUpperCase());
}

/**
 * Per l'Italia l'indirizzo arriva come "VIA X 1 \n41122 MODENA MO\n":
 * l'ultima riga contiene CAP, città e provincia. Per gli altri paesi, o se il
 * formato non torna, l'indirizzo resta intero su una riga.
 */
export function parseIndirizzo(
  raw: string | null,
  nazione: string,
): Pick<DatiVies, "indirizzo" | "cap" | "citta" | "provincia"> {
  const vuoto = { indirizzo: null, cap: null, citta: null, provincia: null };
  if (!raw) return vuoto;
  const righe = raw.split("\n").map((r) => r.trim()).filter(Boolean);
  if (righe.length === 0) return vuoto;

  if (nazione === "IT" && righe.length >= 2) {
    const match = /^(\d{5})\s+(.+?)\s+([A-Z]{2})$/.exec(righe[righe.length - 1]);
    if (match) {
      return {
        indirizzo: titleCase(righe.slice(0, -1).join(", ")),
        cap: match[1],
        citta: titleCase(match[2]),
        provincia: match[3],
      };
    }
  }
  return { ...vuoto, indirizzo: titleCase(righe.join(", ")) };
}

export function normalizzaRispostaVies(body: unknown, nazione: string): DatiVies {
  const data = (body ?? {}) as Record<string, unknown>;
  return {
    valida: data.isValid === true,
    ragioneSociale: pulisci(data.name),
    ...parseIndirizzo(pulisci(data.address), nazione),
  };
}
