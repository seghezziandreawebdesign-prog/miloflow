"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { eventiDaIcs } from "@/lib/ics";
import { createClient } from "@/lib/supabase/server";

import { dbErrorMessage, NESSUN_PERMESSO, zodFieldErrors, type ActionResult } from "./types";

const idSchema = z.uuid();

// Il link di iCloud arriva come webcal://: è lo stesso feed in https.
const calendarioEsternoSchema = z.object({
  nome: z.string().trim().min(1, "Scrivi un nome").max(100, "Nome troppo lungo"),
  url: z
    .string()
    .trim()
    .min(1, "Incolla il link del calendario")
    .max(2000, "Link troppo lungo")
    .transform((v) => v.replace(/^webcal:\/\//i, "https://"))
    .refine((v) => /^https:\/\/\S+$/i.test(v), "Serve un link https:// o webcal://"),
  colore: z.union([z.literal(""), z.string().regex(/^#[0-9a-f]{6}$/i, "Colore non valido")]),
  ambito: z.enum(["lavoro", "personale"]),
  attivo: z.boolean(),
});

export type CalendarioEsternoInput = z.input<typeof calendarioEsternoSchema>;

/** La cache copre da 3 mesi fa a 18 mesi avanti, come il feed ICS in uscita. */
const MESI_INDIETRO = 3;
const MESI_AVANTI = 18;
const MAX_DIMENSIONE = 5 * 1024 * 1024;
const STANTIO_MINUTI = 60;

function revalida() {
  revalidatePath("/calendario");
  revalidatePath("/impostazioni");
}

type Supabase = Awaited<ReturnType<typeof createClient>>;

/**
 * Scarica il feed e sostituisce la cache delle occorrenze. L'esito (ora e
 * eventuale errore) resta sul calendario, così le Impostazioni lo mostrano.
 */
async function sincronizza(supabase: Supabase, calendario: { id: string; url: string }): Promise<ActionResult<{ eventi: number }>> {
  try {
    const risposta = await fetch(calendario.url, {
      signal: AbortSignal.timeout(10_000),
      headers: { accept: "text/calendar, */*" },
      cache: "no-store",
    });
    if (!risposta.ok) throw new Error(`il feed risponde ${risposta.status}`);
    const testo = await risposta.text();
    if (testo.length > MAX_DIMENSIONE) throw new Error("il feed supera i 5 MB");
    if (!testo.includes("BEGIN:VCALENDAR")) throw new Error("il link non è un calendario ICS");

    const adesso = new Date();
    const dal = new Date(adesso);
    dal.setMonth(dal.getMonth() - MESI_INDIETRO);
    const al = new Date(adesso);
    al.setMonth(al.getMonth() + MESI_AVANTI);
    const visti = new Set<string>();
    const eventi = eventiDaIcs(testo, dal, al).filter((e) => !visti.has(e.uid) && visti.add(e.uid));

    const cancella = await supabase.from("eventi_esterni").delete().eq("calendario_id", calendario.id);
    if (cancella.error) throw new Error(dbErrorMessage(cancella.error));
    for (let i = 0; i < eventi.length; i += 500) {
      const { error } = await supabase
        .from("eventi_esterni")
        .insert(eventi.slice(i, i + 500).map((e) => ({ ...e, calendario_id: calendario.id })));
      if (error) throw new Error(dbErrorMessage(error));
    }
    await supabase
      .from("calendari_esterni")
      .update({ ultimo_sync: adesso.toISOString(), errore_sync: null })
      .eq("id", calendario.id);
    return { ok: true, data: { eventi: eventi.length } };
  } catch (e) {
    const messaggio =
      e instanceof Error && e.name === "TimeoutError"
        ? "il feed non risponde (timeout)"
        : e instanceof Error
          ? e.message
          : "sincronizzazione non riuscita";
    await supabase
      .from("calendari_esterni")
      .update({ ultimo_sync: new Date().toISOString(), errore_sync: messaggio })
      .eq("id", calendario.id);
    return { ok: false, error: `Sincronizzazione non riuscita: ${messaggio}` };
  }
}

export async function saveCalendarioEsterno(id: string | null, input: unknown): Promise<ActionResult<{ id: string }>> {
  if (id !== null && !idSchema.safeParse(id).success) return NESSUN_PERMESSO;
  const parsed = calendarioEsternoSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Controlla i campi evidenziati", fieldErrors: zodFieldErrors(parsed.error.issues) };
  }
  const supabase = await createClient();
  const valori = { ...parsed.data, colore: parsed.data.colore || null };
  let calendarioId = id;
  if (id === null) {
    calendarioId = crypto.randomUUID();
    const { error } = await supabase.from("calendari_esterni").insert({ id: calendarioId, ...valori });
    if (error) return { ok: false, error: dbErrorMessage(error, "Salvataggio non riuscito") };
  } else {
    const { data, error } = await supabase.from("calendari_esterni").update(valori).eq("id", id).select("id");
    if (error) return { ok: false, error: dbErrorMessage(error, "Salvataggio non riuscito") };
    if (data.length === 0) return NESSUN_PERMESSO;
  }
  // Prima sincronizzazione subito: se fallisce, l'errore resta visibile
  // sul calendario e si può riprovare.
  if (valori.attivo) await sincronizza(supabase, { id: calendarioId!, url: valori.url });
  revalida();
  return { ok: true, data: { id: calendarioId! } };
}

export async function deleteCalendarioEsterno(id: string): Promise<ActionResult> {
  if (!idSchema.safeParse(id).success) return NESSUN_PERMESSO;
  const supabase = await createClient();
  const { data, error } = await supabase.from("calendari_esterni").delete().eq("id", id).select("id");
  if (error) return { ok: false, error: dbErrorMessage(error, "Eliminazione non riuscita") };
  if (data.length === 0) return NESSUN_PERMESSO;
  revalida();
  return { ok: true };
}

/**
 * Sincronizza i calendari attivi dell'utente: tutti con `forza`, altrimenti
 * solo quelli mai sincronizzati o più vecchi di un'ora. La chiama il
 * calendario all'apertura e il pulsante nelle Impostazioni.
 */
export async function sincronizzaCalendariEsterni({ forza = false }: { forza?: boolean } = {}): Promise<
  ActionResult<{ sincronizzati: number; errori: string[] }>
> {
  const supabase = await createClient();
  const { data: calendari, error } = await supabase
    .from("calendari_esterni")
    .select("id, nome, url, ultimo_sync")
    .eq("attivo", true);
  if (error) return { ok: false, error: dbErrorMessage(error, "Lettura dei calendari non riuscita") };

  const soglia = Date.now() - STANTIO_MINUTI * 60 * 1000;
  const daFare = (calendari ?? []).filter(
    (c) => forza || c.ultimo_sync === null || new Date(c.ultimo_sync).getTime() < soglia,
  );
  const errori: string[] = [];
  let sincronizzati = 0;
  for (const c of daFare) {
    const esito = await sincronizza(supabase, c);
    if (esito.ok) sincronizzati++;
    else errori.push(`${c.nome}: ${esito.error}`);
  }
  if (daFare.length > 0) revalida();
  return { ok: true, data: { sincronizzati, errori } };
}
