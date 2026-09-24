// Allegati nel bucket privato "allegati", percorso <tipo>/<id>/<file>.
// Il nome salvato ha un prefisso univoco; quello mostrato è l'originale ripulito.

export const BUCKET_ALLEGATI = "allegati";
export const MAX_ALLEGATO = 25 * 1024 * 1024; // come il limite del bucket

const PREFISSO_RE = /^\d{13}-[a-z0-9]{4}-/;

/** Nome sicuro per lo Storage: niente accenti, spazi o caratteri speciali. */
export function nomeFileSicuro(nome: string, adesso = Date.now(), casuale = Math.random()): string {
  const punto = nome.lastIndexOf(".");
  const base = punto > 0 ? nome.slice(0, punto) : nome;
  const estensione = punto > 0 ? nome.slice(punto + 1) : "";
  const pulisci = (s: string) =>
    s
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  const b = pulisci(base).slice(0, 80) || "file";
  const e = pulisci(estensione).slice(0, 10).toLowerCase();
  const id = casuale.toString(36).slice(2, 6).padEnd(4, "0");
  return `${adesso}-${id}-${b}${e ? `.${e}` : ""}`;
}

/** Nome da mostrare: senza il prefisso univoco. */
export function nomeVisibile(nomeSalvato: string): string {
  return nomeSalvato.replace(PREFISSO_RE, "");
}

/** Gli screenshot incollati arrivano come "image.png": gli si dà un nome utile. */
export function nomeScreenshot(tipo: string, adesso: Date): string {
  const estensione = tipo.split("/")[1]?.replace("jpeg", "jpg") || "png";
  const p = (n: number) => String(n).padStart(2, "0");
  return `screenshot-${adesso.getFullYear()}-${p(adesso.getMonth() + 1)}-${p(adesso.getDate())}-${p(adesso.getHours())}${p(adesso.getMinutes())}${p(adesso.getSeconds())}.${estensione}`;
}

export function isImmagine(mime: string | null | undefined): boolean {
  return Boolean(mime && /^image\/(png|jpe?g|gif|webp|avif)$/.test(mime));
}

const dimensione = new Intl.NumberFormat("it-IT", { maximumFractionDigits: 1 });

export function formatDimensione(byte: number): string {
  if (byte < 1024) return `${byte} B`;
  if (byte < 1024 * 1024) return `${dimensione.format(byte / 1024)} KB`;
  return `${dimensione.format(byte / 1024 / 1024)} MB`;
}
