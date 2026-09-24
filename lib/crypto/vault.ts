// Cifratura delle credenziali, solo nel browser (Web Crypto).
//
// Master password → PBKDF2-SHA256 (≥ 600.000 iterazioni, salt della cassaforte)
// → chiave madre HKDF, non estraibile, tenuta solo in memoria.
// Ogni credenziale ha il proprio salt casuale: HKDF(chiave madre, salt) → chiave
// AES-GCM a 256 bit, con IV casuale da 12 byte.
// Un valore di controllo cifrato permette di dire "master password errata".

export const ITERAZIONI_MINIME = 600_000;
const TESTO_CONTROLLO = "milo-flow:cassaforte:v1";
const INFO_CREDENZIALE = new TextEncoder().encode("milo-flow:credenziale:v1");
const INFO_CONTROLLO = new TextEncoder().encode("milo-flow:controllo:v1");

export type ParametriCassaforte = {
  salt: string;
  iterazioni: number;
  iv: string;
  verifica_cifrata: string;
};

export type CredenzialeCifrata = { payload_cifrato: string; iv: string; salt: string };

export class MasterPasswordErrata extends Error {
  constructor() {
    super("Master password errata");
    this.name = "MasterPasswordErrata";
  }
}

// ---------- base64 ----------

export function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

export function fromBase64(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function randomBytes(length: number): Uint8Array<ArrayBuffer> {
  return crypto.getRandomValues(new Uint8Array(length));
}

// ---------- chiavi ----------

/** Deriva la chiave madre dalla master password. È l'operazione lenta. */
export async function derivaChiaveMadre(
  password: string,
  salt: Uint8Array<ArrayBuffer>,
  iterazioni: number,
): Promise<CryptoKey> {
  if (iterazioni < ITERAZIONI_MINIME) throw new Error("Iterazioni PBKDF2 insufficienti");
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: iterazioni }, base, 256);
  return crypto.subtle.importKey("raw", bits, "HKDF", false, ["deriveKey"]);
}

function derivaChiaveAes(madre: CryptoKey, salt: Uint8Array<ArrayBuffer>, info: Uint8Array<ArrayBuffer>) {
  return crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt, info },
    madre,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

async function cifra(chiave: CryptoKey, testo: string) {
  const iv = randomBytes(12);
  const buffer = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, chiave, new TextEncoder().encode(testo));
  return { payload: toBase64(new Uint8Array(buffer)), iv: toBase64(iv) };
}

async function decifra(chiave: CryptoKey, payload: string, iv: string) {
  const buffer = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromBase64(iv) }, chiave, fromBase64(payload));
  return new TextDecoder().decode(buffer);
}

// ---------- cassaforte ----------

/** Crea i parametri di una nuova cassaforte a partire dalla master password. */
export async function creaCassaforte(
  password: string,
  iterazioni = ITERAZIONI_MINIME,
): Promise<{ parametri: ParametriCassaforte; chiave: CryptoKey }> {
  const salt = randomBytes(16);
  const chiave = await derivaChiaveMadre(password, salt, iterazioni);
  const controllo = await derivaChiaveAes(chiave, salt, INFO_CONTROLLO);
  const { payload, iv } = await cifra(controllo, TESTO_CONTROLLO);
  return { parametri: { salt: toBase64(salt), iterazioni, iv, verifica_cifrata: payload }, chiave };
}

/** Sblocca la cassaforte. Lancia MasterPasswordErrata se la password non è quella giusta. */
export async function sbloccaCassaforte(password: string, p: ParametriCassaforte): Promise<CryptoKey> {
  const salt = fromBase64(p.salt);
  const chiave = await derivaChiaveMadre(password, salt, p.iterazioni);
  const controllo = await derivaChiaveAes(chiave, salt, INFO_CONTROLLO);
  try {
    if ((await decifra(controllo, p.verifica_cifrata, p.iv)) !== TESTO_CONTROLLO) throw new MasterPasswordErrata();
  } catch {
    throw new MasterPasswordErrata();
  }
  return chiave;
}

// ---------- credenziali ----------

export async function cifraCredenziale(madre: CryptoKey, segreto: string): Promise<CredenzialeCifrata> {
  const salt = randomBytes(16);
  const chiave = await derivaChiaveAes(madre, salt, INFO_CREDENZIALE);
  const { payload, iv } = await cifra(chiave, segreto);
  return { payload_cifrato: payload, iv, salt: toBase64(salt) };
}

export async function decifraCredenziale(madre: CryptoKey, c: CredenzialeCifrata): Promise<string> {
  const chiave = await derivaChiaveAes(madre, fromBase64(c.salt), INFO_CREDENZIALE);
  return decifra(chiave, c.payload_cifrato, c.iv);
}
