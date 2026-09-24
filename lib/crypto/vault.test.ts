import { describe, expect, it } from "vitest";

import {
  cifraCredenziale,
  creaCassaforte,
  decifraCredenziale,
  derivaChiaveMadre,
  fromBase64,
  MasterPasswordErrata,
  sbloccaCassaforte,
} from "./vault";

describe("cassaforte", () => {
  it("cifra e decifra una credenziale dopo lo sblocco", { timeout: 20_000 }, async () => {
    const { parametri } = await creaCassaforte("una master password lunga");
    const chiave = await sbloccaCassaforte("una master password lunga", parametri);
    const cifrata = await cifraCredenziale(chiave, "s3gr3t0!àè");
    expect(cifrata.payload_cifrato).not.toContain("s3gr3t0");
    expect(await decifraCredenziale(chiave, cifrata)).toBe("s3gr3t0!àè");
  });

  it("rifiuta una master password errata", { timeout: 20_000 }, async () => {
    const { parametri } = await creaCassaforte("giusta-giusta-giusta");
    await expect(sbloccaCassaforte("sbagliata-sbagliata", parametri)).rejects.toBeInstanceOf(MasterPasswordErrata);
  });

  it("usa salt e IV diversi per ogni credenziale", { timeout: 20_000 }, async () => {
    const { chiave } = await creaCassaforte("password della cassaforte");
    const a = await cifraCredenziale(chiave, "stesso testo");
    const b = await cifraCredenziale(chiave, "stesso testo");
    expect(a.salt).not.toBe(b.salt);
    expect(a.iv).not.toBe(b.iv);
    expect(a.payload_cifrato).not.toBe(b.payload_cifrato);
    expect(fromBase64(a.iv)).toHaveLength(12);
  });

  it("rileva una credenziale manomessa", { timeout: 20_000 }, async () => {
    const { chiave } = await creaCassaforte("password della cassaforte");
    const c = await cifraCredenziale(chiave, "segreto");
    const bytes = fromBase64(c.payload_cifrato);
    bytes[0] ^= 1;
    const manomessa = { ...c, payload_cifrato: btoa(String.fromCharCode(...bytes)) };
    await expect(decifraCredenziale(chiave, manomessa)).rejects.toThrow();
  });

  it("richiede almeno 600.000 iterazioni", async () => {
    await expect(derivaChiaveMadre("x", new Uint8Array(16), 1000)).rejects.toThrow();
    await expect(creaCassaforte("x", 100_000)).rejects.toThrow();
  });
});
