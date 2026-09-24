// Feed ICS del calendario, da sottoscrivere in Google Calendar o Apple Calendar.
// GET ?token=<token>: il token sta in impostazioni_calendario e si rigenera
// dalle Impostazioni. Il feed è disponibile per l'owner: legge con la service
// role, quindi non può impersonare le policy di un collaboratore.

import { createClient } from "npm:@supabase/supabase-js@2";

const TIPI_VALIDI = new Set(["task", "deadline", "scadenza_servizio", "evento", "rata", "movimento"]);

function testo(body: string, status = 200, contentType = "text/plain; charset=utf-8") {
  return new Response(body, { status, headers: { "Content-Type": contentType, "Cache-Control": "no-store" } });
}

/** Testo ICS: niente ritorni a capo e caratteri speciali con l'escape. */
function icsEscape(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Righe ICS di al massimo 75 byte, continuate con uno spazio. */
function piega(riga: string): string {
  const out: string[] = [];
  let resto = riga;
  while (new TextEncoder().encode(resto).length > 75) {
    let taglio = 75;
    while (new TextEncoder().encode(resto.slice(0, taglio)).length > 75) taglio--;
    out.push(resto.slice(0, taglio));
    resto = " " + resto.slice(taglio);
  }
  out.push(resto);
  return out.join("\r\n");
}

function utcIcs(istante: string): string {
  return new Date(istante).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

/** Giorno di Roma "yyyyMMdd" di un istante. */
function giornoRoma(istante: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(new Date(istante)).replace(/-/g, "");
}

function giornoDopo(yyyymmdd: string): string {
  const d = new Date(Date.UTC(Number(yyyymmdd.slice(0, 4)), Number(yyyymmdd.slice(4, 6)) - 1, Number(yyyymmdd.slice(6, 8)), 12));
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}

const ETICHETTE: Record<string, string> = {
  task: "Task",
  deadline: "Scadenza task",
  scadenza_servizio: "Scadenza servizio",
  evento: "Evento",
  rata: "Rata",
  movimento: "Spesa prevista",
};

Deno.serve(async (req) => {
  if (req.method !== "GET") return testo("Metodo non consentito", 405);
  const token = new URL(req.url).searchParams.get("token");
  if (!token || !/^[0-9a-f]{64}$/.test(token)) return testo("Token mancante o non valido", 401);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });
  const { data: impostazioni } = await admin
    .from("impostazioni_calendario")
    .select("user_id, ics_include, ics_ambito, profili(ruolo)")
    .eq("token_ics", token)
    .maybeSingle();
  if (!impostazioni) return testo("Token non valido", 401);
  const ruolo = (impostazioni.profili as { ruolo?: string } | null)?.ruolo;
  if (ruolo !== "owner") return testo("Il feed è disponibile solo per l'owner", 403);

  const include = (impostazioni.ics_include as string[]).filter((t) => TIPI_VALIDI.has(t));
  if (include.length === 0) return testo(calendarioVuoto(), 200, "text/calendar; charset=utf-8");

  // Finestra: da 3 mesi fa a 18 mesi avanti; le ricorrenze le espande il client del calendario.
  const da = new Date();
  da.setMonth(da.getMonth() - 3);
  const a = new Date();
  a.setMonth(a.getMonth() + 18);
  let q = admin
    .from("v_calendario")
    .select("id, tipo, titolo, inizio, fine, tutto_il_giorno, ambito, ricorrenza")
    .in("tipo", include)
    .lt("inizio", a.toISOString())
    .or(`ricorrenza.not.is.null,inizio.gte.${da.toISOString()}`);
  if (impostazioni.ics_ambito) q = q.eq("ambito", impostazioni.ics_ambito);
  const { data: righe, error } = await q;
  if (error) return testo("Lettura non riuscita", 500);

  const site = Deno.env.get("SITE_URL") ?? "";
  const righeIcs: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Milo Flow//Calendario//IT",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Milo Flow",
    "X-WR-TIMEZONE:Europe/Rome",
  ];
  for (const r of righe ?? []) {
    const uid = `${r.tipo}-${r.id}@miloflow`;
    const titolo = r.tipo === "deadline" ? `Entro: ${r.titolo}` : r.tipo === "scadenza_servizio" ? `Scade: ${r.titolo}` : r.titolo;
    const apri = { task: "task", deadline: "task", scadenza_servizio: "servizio", evento: "evento", rata: "debito", movimento: "movimento" }[r.tipo]!;
    righeIcs.push("BEGIN:VEVENT", `UID:${uid}`, `DTSTAMP:${utcIcs(new Date().toISOString())}`);
    if (r.tutto_il_giorno) {
      const inizio = giornoRoma(r.inizio);
      const fine = r.fine ? giornoRoma(r.fine) : giornoDopo(inizio);
      righeIcs.push(`DTSTART;VALUE=DATE:${inizio}`, `DTEND;VALUE=DATE:${fine <= inizio ? giornoDopo(inizio) : fine}`);
    } else {
      righeIcs.push(`DTSTART:${utcIcs(r.inizio)}`);
      if (r.fine) righeIcs.push(`DTEND:${utcIcs(r.fine)}`);
    }
    if (r.ricorrenza) righeIcs.push(`RRULE:${r.ricorrenza.replace(/^RRULE:/, "")}`);
    righeIcs.push(piega(`SUMMARY:${icsEscape(titolo)}`));
    righeIcs.push(piega(`CATEGORIES:${icsEscape(ETICHETTE[r.tipo] ?? r.tipo)},${r.ambito === "personale" ? "Personale" : "Lavoro"}`));
    if (site) righeIcs.push(piega(`URL:${site}/oggi?apri=${apri}:${r.id}`));
    righeIcs.push("END:VEVENT");
  }
  righeIcs.push("END:VCALENDAR");
  return testo(righeIcs.join("\r\n") + "\r\n", 200, "text/calendar; charset=utf-8");
});

function calendarioVuoto(): string {
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Milo Flow//Calendario//IT", "X-WR-CALNAME:Milo Flow", "END:VCALENDAR"].join("\r\n") + "\r\n";
}
