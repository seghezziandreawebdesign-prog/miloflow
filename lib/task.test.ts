import { describe, expect, it } from "vitest";

import { parseTaskRapida } from "@/lib/parsing/task-rapida";
import { taskDaRapida, taskSchema, taskToDb, taskVuota } from "@/lib/schemas/task";

import {
  confrontaTask,
  daSollecitare,
  giorniInAttesa,
  isInbox,
  isPianificataInRitardo,
  isScaduta,
  ordineTra,
  avanzamento,
  prossimiGiorni,
  raggruppaPerGiorno,
} from "./task";

const oggi = "2026-09-24";

function task(extra: Partial<Parameters<typeof isInbox>[0]> & Record<string, unknown> = {}) {
  return {
    stato: "da_fare" as const,
    data_pianificata: null,
    scadenza: null,
    in_attesa_dal: null,
    progetto_id: null,
    parent_id: null,
    priorita: null,
    ordine: 0,
    created_at: "2026-09-01T10:00:00Z",
    ...extra,
  };
}

describe("ritardi", () => {
  it("pianificata in ritardo solo se aperta e nel passato", () => {
    expect(isPianificataInRitardo(task({ data_pianificata: "2026-09-23" }), oggi)).toBe(true);
    expect(isPianificataInRitardo(task({ data_pianificata: oggi }), oggi)).toBe(false);
    expect(isPianificataInRitardo(task({ data_pianificata: "2026-09-23", stato: "fatto" }), oggi)).toBe(false);
  });

  it("scaduta", () => {
    expect(isScaduta(task({ scadenza: "2026-09-20" }), oggi)).toBe(true);
    expect(isScaduta(task({ scadenza: oggi }), oggi)).toBe(false);
  });
});

describe("in attesa", () => {
  it("conta i giorni e segnala oltre i 5", () => {
    const t = task({ stato: "in_attesa", in_attesa_dal: "2026-09-18" });
    expect(giorniInAttesa(t, oggi)).toBe(6);
    expect(daSollecitare(t, oggi)).toBe(true);
    expect(daSollecitare(task({ stato: "in_attesa", in_attesa_dal: "2026-09-19" }), oggi)).toBe(false);
    expect(giorniInAttesa(task(), oggi)).toBeNull();
  });
});

describe("inbox", () => {
  it("senza date e senza progetto", () => {
    expect(isInbox(task())).toBe(true);
    expect(isInbox(task({ scadenza: oggi }))).toBe(false);
    expect(isInbox(task({ progetto_id: "p" }))).toBe(false);
    expect(isInbox(task({ parent_id: "t" }))).toBe(false);
  });
});

describe("raggruppaPerGiorno", () => {
  it("usa la pianificata, poi la scadenza, e mette i ritardi nel primo giorno", () => {
    const giorni = prossimiGiorni(oggi, 3);
    expect(giorni).toEqual(["2026-09-24", "2026-09-25", "2026-09-26"]);
    const a = task({ data_pianificata: "2026-09-25" });
    const b = task({ scadenza: "2026-09-26" });
    const c = task({ data_pianificata: "2026-09-01" });
    const d = task({ data_pianificata: "2026-10-30" });
    const e = task();
    const gruppi = raggruppaPerGiorno([a, b, c, d, e], giorni);
    expect(gruppi.get("2026-09-24")).toEqual([c]);
    expect(gruppi.get("2026-09-25")).toEqual([a]);
    expect(gruppi.get("2026-09-26")).toEqual([b]);
  });
});

describe("ordinamento", () => {
  it("priorità, poi giorno, poi ordine", () => {
    const alta = task({ priorita: 1 });
    const bassa = task({ priorita: 3 });
    const senza = task();
    const primaData = task({ data_pianificata: "2026-09-20" });
    expect([senza, bassa, alta].sort(confrontaTask)).toEqual([alta, bassa, senza]);
    expect([senza, primaData].sort(confrontaTask)).toEqual([primaData, senza]);
  });

  it("ordineTra", () => {
    expect(ordineTra(null, null)).toBe(0);
    expect(ordineTra(null, 5)).toBe(4);
    expect(ordineTra(5, null)).toBe(6);
    expect(ordineTra(1, 2)).toBe(1.5);
  });

  it("avanzamento", () => {
    expect(avanzamento(0, 0)).toBe(0);
    expect(avanzamento(1, 3)).toBe(33);
    expect(avanzamento(3, 3)).toBe(100);
  });
});

describe("schema task", () => {
  it("accetta una task minima e converte i vuoti in null", () => {
    const v = taskSchema.parse({ ...taskVuota("lavoro"), titolo: "  Chiamare  ", priorita: "1", durata_min: "30" });
    expect(v.titolo).toBe("Chiamare");
    expect(taskToDb(v)).toMatchObject({ titolo: "Chiamare", priorita: 1, durata_min: 30, note: null, progetto_id: null });
  });

  it("rifiuta titolo vuoto, date e ricorrenze non valide", () => {
    const base = { ...taskVuota("lavoro"), titolo: "X" };
    expect(taskSchema.safeParse({ ...base, titolo: " " }).success).toBe(false);
    expect(taskSchema.safeParse({ ...base, scadenza: "2026-02-30" }).success).toBe(false);
    expect(taskSchema.safeParse({ ...base, ricorrenza: "boh" }).success).toBe(false);
    expect(taskSchema.safeParse({ ...base, ricorrenza: "FREQ=WEEKLY;BYDAY=MO" }).success).toBe(true);
    expect(taskSchema.safeParse({ ...base, durata_min: "0" }).success).toBe(false);
  });

  it("taskToDb include solo i campi presenti", () => {
    expect(taskToDb({ data_pianificata: "" })).toEqual({ data_pianificata: null });
  });
});

describe("taskDaRapida", () => {
  const onis = { tipo: "cliente" as const, id: "11111111-1111-4111-8111-111111111111", nome: "Onis" };
  const casa = {
    tipo: "progetto" as const, id: "22222222-2222-4222-8222-222222222222", nome: "Casa", clienteId: null, ambito: "personale" as const,
  };

  it("il criterio della fase 3: «Chiamare fornitore domani #onis !alta»", () => {
    const parsed = parseTaskRapida("Chiamare fornitore domani #onis !alta", { oggi, riferimenti: [onis] });
    const v = taskDaRapida(parsed, { ambito: "personale" });
    expect(v).toMatchObject({
      titolo: "Chiamare fornitore",
      data_pianificata: "2026-09-25",
      priorita: "1",
      cliente_id: onis.id,
      ambito: "lavoro",
    });
    expect(taskSchema.safeParse(v).success).toBe(true);
  });

  it("il progetto porta il suo ambito; i default del contesto restano se il testo non dice altro", () => {
    const parsed = parseTaskRapida("Pagare bolletta #casa", { oggi, riferimenti: [casa] });
    const v = taskDaRapida(parsed, { ambito: "lavoro", servizio_id: "33333333-3333-4333-8333-333333333333", scadenza: "2026-10-01" });
    expect(v).toMatchObject({ ambito: "personale", progetto_id: casa.id, scadenza: "2026-10-01", servizio_id: "33333333-3333-4333-8333-333333333333" });
  });
});
