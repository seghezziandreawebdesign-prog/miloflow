// Descrizioni delle task: HTML prodotto dall'editor. Le note scritte prima
// dell'editor sono testo semplice e vanno convertite.

function escape(testo: string): string {
  return testo.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Valore salvato → HTML per l'editor. Il testo semplice diventa paragrafi. */
export function testoInHtml(valore: string | null | undefined): string {
  const v = (valore ?? "").trim();
  if (!v) return "";
  if (v.startsWith("<")) return v;
  return v
    .split(/\n{2,}/)
    .map((paragrafo) => `<p>${paragrafo.split("\n").map(escape).join("<br>")}</p>`)
    .join("");
}

const ENTITA: Record<string, string> = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&nbsp;": " " };

/** HTML → testo semplice, per la ricerca e le anteprime. */
export function testoSemplice(valore: string | null | undefined): string {
  return (valore ?? "")
    .replace(/<(br|\/p|\/li|\/h[1-6]|\/blockquote)[^>]*>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (m) => ENTITA[m] ?? m)
    .replace(/\s+/g, " ")
    .trim();
}
