// Backup: forma del file, percorsi dei file dello Storage da includere e
// controlli sul contenuto. Funzioni pure, con test.

export const VERSIONE_BACKUP = 1;

/** Cartella dentro lo ZIP che contiene i file dello Storage: file/<bucket>/<percorso>. */
export const CARTELLA_FILE = "file/";

export type BackupDati = {
  app: "miloflow";
  versione: number;
  generato_il: string;
  owner_id: string | null;
  [tabella: string]: unknown;
};

export type FileBackup = { bucket: "loghi" | "ricevute" | "allegati"; percorso: string };

function righe(dati: BackupDati, tabella: string): Record<string, unknown>[] {
  const v = dati[tabella];
  return Array.isArray(v) ? (v as Record<string, unknown>[]) : [];
}

/** Controlla che l'oggetto sia un backup di Milo Flow leggibile. */
export function validaBackup(obj: unknown): { ok: true; dati: BackupDati } | { ok: false; errore: string } {
  if (!obj || typeof obj !== "object") return { ok: false, errore: "Il file non contiene un backup" };
  const d = obj as Record<string, unknown>;
  if (d.app !== "miloflow") return { ok: false, errore: "Il file non è un backup di Milo Flow" };
  if (d.versione !== VERSIONE_BACKUP) return { ok: false, errore: `Versione del backup non supportata (${String(d.versione)})` };
  for (const t of ["clienti", "servizi", "task", "movimenti"]) {
    if (!Array.isArray(d[t])) return { ok: false, errore: `Nel backup manca la tabella ${t}` };
  }
  return { ok: true, dati: d as BackupDati };
}

/** File singoli citati dalle righe: loghi dei clienti e ricevute dei movimenti. */
export function fileDalleRighe(dati: BackupDati): FileBackup[] {
  const out: FileBackup[] = [];
  for (const c of righe(dati, "clienti")) {
    if (typeof c.logo_path === "string" && c.logo_path) out.push({ bucket: "loghi", percorso: c.logo_path });
  }
  for (const m of righe(dati, "movimenti")) {
    if (typeof m.ricevuta_path === "string" && m.ricevuta_path) out.push({ bucket: "ricevute", percorso: m.ricevuta_path });
  }
  return out;
}

/** Cartelle degli allegati da elencare nello Storage (una per task). */
export function cartelleAllegati(dati: BackupDati): string[] {
  return righe(dati, "task")
    .map((t) => t.id)
    .filter((id): id is string => typeof id === "string")
    .map((id) => `task/${id}`);
}

/** Da una voce dello ZIP ("file/<bucket>/<percorso>") a bucket e percorso. */
export function fileDaVoceZip(nome: string): FileBackup | null {
  if (!nome.startsWith(CARTELLA_FILE)) return null;
  const resto = nome.slice(CARTELLA_FILE.length);
  const slash = resto.indexOf("/");
  if (slash <= 0) return null;
  const bucket = resto.slice(0, slash);
  const percorso = resto.slice(slash + 1);
  if (!percorso || (bucket !== "loghi" && bucket !== "ricevute" && bucket !== "allegati")) return null;
  return { bucket, percorso };
}

export function voceZip(f: FileBackup): string {
  return `${CARTELLA_FILE}${f.bucket}/${f.percorso}`;
}

/** Nome del file di backup: miloflow-backup-2026-09-24.zip */
export function nomeFileBackup(oggi: string): string {
  return `miloflow-backup-${oggi}.zip`;
}

/** Tipo MIME dall'estensione, per ricaricare i file nello Storage. */
export function mimeDaNome(nome: string): string {
  const e = nome.split(".").pop()?.toLowerCase() ?? "";
  const mappa: Record<string, string> = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    webp: "image/webp",
    gif: "image/gif",
    avif: "image/avif",
    heic: "image/heic",
    svg: "image/svg+xml",
    pdf: "application/pdf",
    txt: "text/plain",
    csv: "text/csv",
    json: "application/json",
    zip: "application/zip",
  };
  return mappa[e] ?? "application/octet-stream";
}

/** Conteggio delle righe per tabella, per il riepilogo. */
export function conteggiBackup(dati: BackupDati): { tabella: string; righe: number }[] {
  return Object.entries(dati)
    .filter(([, v]) => Array.isArray(v))
    .map(([tabella, v]) => ({ tabella, righe: (v as unknown[]).length }))
    .filter((c) => c.righe > 0);
}
