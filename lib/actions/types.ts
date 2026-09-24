export type ActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? object : { data: T }))
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

type PostgrestLikeError = { code?: string; message: string };

// Messaggi comprensibili per gli errori più comuni del database.
export function dbErrorMessage(error: PostgrestLikeError, fallback = "Operazione non riuscita"): string {
  if (error.code === "23505") return "Esiste già un elemento con questi dati";
  if (error.code === "42501") return "Non hai i permessi per questa operazione";
  if (error.code === "23514") return "Alcuni dati non sono validi";
  return fallback;
}

export function zodFieldErrors(issues: { path: PropertyKey[]; message: string }[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of issues) {
    const key = issue.path.map(String).join(".");
    out[key] ??= issue.message;
  }
  return out;
}
