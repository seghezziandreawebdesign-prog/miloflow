// Invio tramite l'API di Resend.

export async function inviaEmail(params: {
  apiKey: string;
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
}): Promise<{ ok: true; id: string } | { ok: false; status: number; errore: string }> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${params.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: params.from,
      to: [params.to],
      subject: params.subject,
      html: params.html,
      text: params.text,
      ...(params.replyTo ? { reply_to: params.replyTo } : {}),
    }),
    signal: AbortSignal.timeout(15_000),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, status: res.status, errore: String(body?.message ?? res.statusText) };
  return { ok: true, id: String(body?.id ?? "") };
}

/** Data e ora correnti a Roma: { data: "yyyy-MM-dd", ora: "HH:mm" }. */
export function adessoARoma(now = new Date()): { data: string; ora: string } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Rome",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  return { data: `${parts.year}-${parts.month}-${parts.day}`, ora: `${parts.hour}:${parts.minute}` };
}
