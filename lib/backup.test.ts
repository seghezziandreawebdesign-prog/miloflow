import { describe, expect, it } from "vitest";

import { cartelleAllegati, conteggiBackup, fileDalleRighe, fileDaVoceZip, mimeDaNome, nomeFileBackup, validaBackup, voceZip, type BackupDati } from "./backup";

const base: BackupDati = {
  app: "miloflow",
  versione: 1,
  generato_il: "2026-09-24T10:00:00Z",
  owner_id: "u1",
  clienti: [{ id: "c1", logo_path: "c1/logo.png" }, { id: "c2", logo_path: null }],
  servizi: [],
  task: [{ id: "t1" }, { id: "t2" }],
  movimenti: [{ id: "m1", ricevuta_path: "m1/scontrino.jpg" }, { id: "m2", ricevuta_path: null }],
};

describe("backup", () => {
  it("valida la forma del file", () => {
    expect(validaBackup(base).ok).toBe(true);
    expect(validaBackup(null)).toMatchObject({ ok: false });
    expect(validaBackup({ app: "altro", versione: 1 })).toMatchObject({ ok: false, errore: "Il file non è un backup di Milo Flow" });
    expect(validaBackup({ ...base, versione: 2 })).toMatchObject({ ok: false });
    expect(validaBackup({ ...base, task: undefined })).toMatchObject({ ok: false, errore: "Nel backup manca la tabella task" });
  });

  it("elenca i file citati dalle righe e le cartelle degli allegati", () => {
    expect(fileDalleRighe(base)).toEqual([
      { bucket: "loghi", percorso: "c1/logo.png" },
      { bucket: "ricevute", percorso: "m1/scontrino.jpg" },
    ]);
    expect(cartelleAllegati(base)).toEqual(["task/t1", "task/t2"]);
  });

  it("converte le voci dello ZIP", () => {
    const f = { bucket: "allegati" as const, percorso: "task/t1/a b.pdf" };
    expect(voceZip(f)).toBe("file/allegati/task/t1/a b.pdf");
    expect(fileDaVoceZip(voceZip(f))).toEqual(f);
    expect(fileDaVoceZip("dati.json")).toBeNull();
    expect(fileDaVoceZip("file/altro/x")).toBeNull();
    expect(fileDaVoceZip("file/loghi/")).toBeNull();
  });

  it("nome e tipi dei file", () => {
    expect(nomeFileBackup("2026-09-24")).toBe("miloflow-backup-2026-09-24.zip");
    expect(mimeDaNome("foto.JPG")).toBe("image/jpeg");
    expect(mimeDaNome("x.bin")).toBe("application/octet-stream");
  });

  it("conta le righe per tabella", () => {
    expect(conteggiBackup(base)).toEqual([
      { tabella: "clienti", righe: 2 },
      { tabella: "task", righe: 2 },
      { tabella: "movimenti", righe: 2 },
    ]);
  });
});
