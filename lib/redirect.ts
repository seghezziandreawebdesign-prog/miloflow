// Accetta solo percorsi interni, per evitare open redirect tramite ?next=.
export function safeNextPath(value: string | null | undefined, fallback = "/oggi"): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
    return fallback;
  }
  return value;
}
