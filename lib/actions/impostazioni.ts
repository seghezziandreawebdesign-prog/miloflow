"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

import { dbErrorMessage, zodFieldErrors, type ActionResult } from "./types";

const notificheSchema = z.object({
  email: z.string().trim().refine((v) => v === "" || z.email().safeParse(v).success, "Email non valida"),
  orario: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Orario non valido"),
  giorni_anticipo: z.coerce.number().int().min(0, "Da 0 a 60").max(60, "Da 0 a 60"),
  attivo: z.boolean(),
});

export async function saveImpostazioniNotifiche(input: unknown): Promise<ActionResult> {
  const parsed = notificheSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Controlla i campi evidenziati", fieldErrors: zodFieldErrors(parsed.error.issues) };
  }
  if (parsed.data.attivo && !parsed.data.email) {
    return { ok: false, error: "Serve un'email per attivare il riepilogo", fieldErrors: { email: "Inserisci l'email" } };
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("impostazioni_notifiche")
    .update({ ...parsed.data, email: parsed.data.email || null })
    .eq("singleton", true)
    .select("id");
  if (error) return { ok: false, error: dbErrorMessage(error) };
  if (data.length === 0) return { ok: false, error: "Solo l'owner può modificare le notifiche" };
  revalidatePath("/impostazioni");
  return { ok: true };
}

export async function inviaProvaDigest(): Promise<ActionResult<{ messaggio: string }>> {
  const supabase = await createClient();
  const { data, error } = await supabase.functions.invoke("digest-scadenze", { body: { prova: true } });
  if (error) {
    let motivo = "Invio non riuscito";
    try {
      const body = await (error as { context?: Response }).context?.json();
      motivo = body?.motivo ?? body?.errore ?? motivo;
    } catch {
      // risposta non leggibile
    }
    return { ok: false, error: motivo };
  }
  return {
    ok: true,
    data: { messaggio: data?.inviata ? "Email di prova inviata: controlla la posta" : (data?.motivo ?? "Non inviata") },
  };
}
