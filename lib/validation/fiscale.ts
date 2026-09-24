// Normalizzazione e controlli di P.IVA e codice fiscale. Funzioni pure.

/** Toglie spazi, punti, trattini e l'eventuale prefisso del paese (es. "IT"). */
export function normalizePiva(value: string, nazione: string): string {
  const compact = value.replace(/[\s.\-]/g, "").toUpperCase();
  const prefix = nazione === "GR" ? "EL" : nazione;
  return compact.startsWith(prefix) ? compact.slice(prefix.length) : compact;
}

/** P.IVA italiana: 11 cifre con cifra di controllo (algoritmo di Luhn modificato). */
export function isValidPivaIT(piva: string): boolean {
  if (!/^\d{11}$/.test(piva)) return false;
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    let digit = Number(piva[i]);
    if (i % 2 === 1) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  return (10 - (sum % 10)) % 10 === Number(piva[10]);
}

/** Controllo di formato generico per le P.IVA estere (VIES fa il resto). */
export function isPlausiblePivaEstera(piva: string): boolean {
  return /^[0-9A-Z+*]{2,12}$/.test(piva);
}

// Valori dei caratteri in posizione dispari (1ª, 3ª, …) per il carattere di controllo.
const DISPARI: Record<string, number> = {
  "0": 1, "1": 0, "2": 5, "3": 7, "4": 9, "5": 13, "6": 15, "7": 17, "8": 19, "9": 21,
  A: 1, B: 0, C: 5, D: 7, E: 9, F: 13, G: 15, H: 17, I: 19, J: 21, K: 2, L: 4, M: 18,
  N: 20, O: 11, P: 3, Q: 6, R: 8, S: 12, T: 14, U: 16, V: 10, W: 22, X: 25, Y: 24, Z: 23,
};

function valorePari(char: string): number {
  return /\d/.test(char) ? Number(char) : char.charCodeAt(0) - 65;
}

/**
 * Codice fiscale italiano: 16 caratteri di una persona fisica (anche con
 * omocodia) con carattere di controllo, oppure 11 cifre di una società
 * (stesso algoritmo della P.IVA).
 */
export function isValidCodiceFiscale(value: string): boolean {
  const cf = value.replace(/\s/g, "").toUpperCase();
  if (/^\d{11}$/.test(cf)) return isValidPivaIT(cf);
  if (!/^[A-Z]{6}[0-9LMNPQRSTUV]{2}[ABCDEHLMPRST][0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{3}[A-Z]$/.test(cf)) {
    return false;
  }
  let sum = 0;
  for (let i = 0; i < 15; i++) {
    sum += i % 2 === 0 ? DISPARI[cf[i]] : valorePari(cf[i]);
  }
  return String.fromCharCode(65 + (sum % 26)) === cf[15];
}
