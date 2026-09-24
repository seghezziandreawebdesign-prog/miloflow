// Avviso di scadenza al cliente. Solo su azione esplicita dell'utente, che
// ha già visto e confermato l'anteprima. Legge i dati con il JWT dell'utente,
// quindi valgono le stesse policy dell'app (servizio e cliente visibili).

import { createClient } from "npm:@supabase/supabase-js@2";

import { escapeHtml } from "../_shared/digest.ts";
import { inviaEmail } from "../_shared/resend.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ errore: "Metodo non consentito" }, 405);

  const authorization = req.headers.get("Authorization");
  if (!authorization) return json({ errore: "Accesso riservato" }, 401);
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const { data: utente } = await supabase.auth.getUser(authorization.replace(/^Bearer\s+/i, ""));
  if (!utente.user) return json({ errore: "Accesso riservato" }, 401);

  const body = await req.json().catch(() => null);
  const servizioId = String(body?.servizio_id ?? "");
  const clienteId = String(body?.cliente_id ?? "");
  const oggetto = String(body?.oggetto ?? "").trim();
  const testo = String(body?.testo ?? "").trim();
  if (!UUID.test(servizioId) || !UUID.test(clienteId) || !oggetto || !testo || oggetto.length > 200 || testo.length > 5000) {
    return json({ errore: "Dati dell'email non validi" }, 400);
  }

  const from = Deno.env.get("RESEND_FROM");
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey || !from || from.includes("resend.dev")) {
    return json({ errore: "Per scrivere ai clienti serve un dominio verificato su Resend" }, 503);
  }

  // Il servizio deve essere collegato al cliente, ed entrambi visibili all'utente.
  const { data: link } = await supabase
    .from("servizi_clienti")
    .select("servizio_id")
    .eq("servizio_id", servizioId)
    .eq("cliente_id", clienteId)
    .maybeSingle();
  if (!link) return json({ errore: "Servizio o cliente non trovato" }, 404);

  const { data: contatto } = await supabase
    .from("clienti_contatti")
    .select("nome, email")
    .eq("cliente_id", clienteId)
    .eq("principale", true)
    .maybeSingle();
  if (!contatto?.email) return json({ errore: "Il cliente non ha un contatto principale con email" }, 422);

  const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;font-size:15px;line-height:1.5;color:#111">${escapeHtml(testo).replace(/\n/g, "<br>")}</div>`;
  const esito = await inviaEmail({
    apiKey,
    from,
    to: contatto.email,
    subject: oggetto,
    html,
    text: testo,
    replyTo: utente.user.email ?? undefined,
  });
  if (!esito.ok) return json({ errore: `Invio non riuscito: ${esito.errore}` }, 502);

  // Traccia nel diario del cliente, così resta memoria dell'avviso.
  await supabase.from("clienti_diario").insert({
    cliente_id: clienteId,
    testo: `Inviato avviso di scadenza a ${contatto.nome} <${contatto.email}>: "${oggetto}"`,
  });

  return json({ inviata: true, a: contatto.email });
});
