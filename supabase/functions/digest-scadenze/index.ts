// Riepilogo del mattino. Due modi di essere chiamata:
// - dal cron (ogni 15 minuti) con l'header x-cron-secret: invia solo se è
//   passato l'orario scelto e oggi non è ancora partita;
// - dall'app con il JWT dell'owner e { prova: true }: invia subito.
// Non invia mai email vuote, tranne la prova (che lo dice esplicitamente).

import { createClient } from "npm:@supabase/supabase-js@2";

import { componiDigest } from "../_shared/digest.ts";
import { adessoARoma, inviaEmail } from "../_shared/resend.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function segretoValido(ricevuto: string | null, atteso: string | undefined): boolean {
  if (!ricevuto || !atteso || ricevuto.length !== atteso.length) return false;
  let diff = 0;
  for (let i = 0; i < atteso.length; i++) diff |= ricevuto.charCodeAt(i) ^ atteso.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ errore: "Metodo non consentito" }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

  // --- Autorizzazione ---
  let prova = false;
  if (segretoValido(req.headers.get("x-cron-secret"), Deno.env.get("CRON_SECRET"))) {
    prova = false;
  } else {
    const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
    const { data: utente } = token ? await admin.auth.getUser(token) : { data: { user: null } };
    if (!utente.user) return json({ errore: "Accesso riservato" }, 401);
    const { data: profilo } = await admin.from("profili").select("ruolo").eq("id", utente.user.id).single();
    if (profilo?.ruolo !== "owner") return json({ errore: "Solo l'owner può inviare il riepilogo" }, 403);
    const body = await req.json().catch(() => ({}));
    prova = body?.prova === true;
    if (!prova) return json({ errore: "Richiesta non valida" }, 400);
  }

  const { data: impostazioni } = await admin.from("impostazioni_notifiche").select("*").single();
  if (!impostazioni?.email) return json({ inviata: false, motivo: "Nessuna email impostata" }, prova ? 422 : 200);

  const { data: oggi, ora } = adessoARoma();
  if (!prova) {
    if (!impostazioni.attivo) return json({ inviata: false, motivo: "Riepilogo disattivato" });
    if (impostazioni.ultimo_invio === oggi) return json({ inviata: false, motivo: "Già inviato oggi" });
    if (ora < String(impostazioni.orario).slice(0, 5)) return json({ inviata: false, motivo: "Non è ancora l'ora" });
  }

  // --- Dati ---
  const limiteRate = new Date(`${oggi}T12:00:00Z`);
  limiteRate.setUTCDate(limiteRate.getUTCDate() + impostazioni.giorni_anticipo);
  const [servizi, task, rate] = await Promise.all([
    admin
      .from("v_servizi")
      .select("id, nome, prossima_scadenza, giorni_alla_scadenza, preavviso_effettivo")
      .eq("stato", "attivo"),
    admin
      .from("task")
      .select("id, titolo, scadenza, data_pianificata")
      .neq("stato", "fatto")
      .is("parent_id", null)
      .or(`scadenza.lt.${oggi},data_pianificata.lt.${oggi}`),
    admin
      .from("debiti_rate")
      .select("id, debito_id, numero, scadenza, importo, debiti(creditore)")
      .eq("pagata", false)
      .lte("scadenza", limiteRate.toISOString().slice(0, 10)),
  ]);

  const digest = componiDigest({
    oggi,
    siteUrl: Deno.env.get("SITE_URL") ?? "https://miloflow.vercel.app",
    servizi: (servizi.data ?? [])
      .filter((s) => (s.giorni_alla_scadenza ?? 0) <= (s.preavviso_effettivo ?? 30))
      .map((s) => ({ id: s.id!, nome: s.nome!, prossima_scadenza: s.prossima_scadenza!, giorni: s.giorni_alla_scadenza! })),
    task: task.data ?? [],
    rate: (rate.data ?? []).map((r) => ({
      id: r.id,
      debito_id: r.debito_id,
      numero: r.numero,
      scadenza: r.scadenza,
      importo: Number(r.importo),
      creditore: (r.debiti as { creditore: string } | null)?.creditore ?? "Debito",
    })),
  });

  const email = digest ?? (prova
    ? {
        oggetto: "Milo Flow · prova del riepilogo",
        html: "<p>Il riepilogo funziona. Oggi non c'è niente da segnalare: in quel caso l'email del mattino non parte.</p>",
        testo: "Il riepilogo funziona. Oggi non c'è niente da segnalare: in quel caso l'email del mattino non parte.",
      }
    : null);
  if (!email) return json({ inviata: false, motivo: "Niente da segnalare" });

  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) return json({ inviata: false, motivo: "RESEND_API_KEY non configurata" }, 503);

  const esito = await inviaEmail({
    apiKey,
    from: Deno.env.get("RESEND_FROM") ?? "Milo Flow <onboarding@resend.dev>",
    to: impostazioni.email,
    subject: email.oggetto,
    html: email.html,
    text: email.testo,
  });
  if (!esito.ok) return json({ inviata: false, motivo: `Resend: ${esito.errore}` }, 502);

  if (!prova) await admin.from("impostazioni_notifiche").update({ ultimo_invio: oggi }).eq("id", impostazioni.id);
  return json({ inviata: true, id: esito.id });
});
