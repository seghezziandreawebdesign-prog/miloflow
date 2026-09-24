// Interroga VIES (Commissione Europea) e restituisce i dati normalizzati.
// Chiamata dal form di creazione cliente con il JWT dell'utente. Il gateway
// verifica la firma (verify_jwt), ma accetta anche la chiave anon pubblica:
// qui si controlla che il token sia di un utente loggato.
// Non blocca mai il form: se VIES non risponde, torna { disponibile: false }.

import { normalizzaRispostaVies } from "../_shared/vies.ts";

const VIES_URL = "https://ec.europa.eu/taxation_customs/vies/rest-api/ms";
const TIMEOUT_MS = 8000;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// La firma è già verificata dal gateway: qui basta leggere il ruolo.
function isUtenteLoggato(req: Request): boolean {
  const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  const payload = token?.split(".")[1];
  if (!payload) return false;
  try {
    const claims = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    return claims.role === "authenticated" && typeof claims.sub === "string";
  } catch {
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ errore: "Metodo non consentito" }, 405);
  if (!isUtenteLoggato(req)) return json({ errore: "Accesso riservato" }, 401);

  let nazione: string;
  let piva: string;
  try {
    const body = await req.json();
    nazione = String(body.nazione ?? "").toUpperCase();
    piva = String(body.piva ?? "").replace(/[\s.\-]/g, "").toUpperCase();
  } catch {
    return json({ errore: "Richiesta non valida" }, 400);
  }
  // VIES usa EL per la Grecia.
  const codicePaese = nazione === "GR" ? "EL" : nazione;
  if (piva.startsWith(codicePaese)) piva = piva.slice(codicePaese.length);
  if (!/^[A-Z]{2}$/.test(nazione) || !/^[0-9A-Z+*]{2,12}$/.test(piva)) {
    return json({ errore: "Paese o P.IVA non validi" }, 400);
  }
  try {
    const res = await fetch(`${VIES_URL}/${codicePaese}/vat/${encodeURIComponent(piva)}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return json({ disponibile: false });
    const body = await res.json();
    // Errori del servizio (stato membro non raggiungibile, troppe richieste…).
    const userError = String(body.userError ?? "");
    if (userError !== "VALID" && userError !== "INVALID") return json({ disponibile: false });
    return json({ disponibile: true, ...normalizzaRispostaVies(body, nazione) });
  } catch {
    return json({ disponibile: false });
  }
});
