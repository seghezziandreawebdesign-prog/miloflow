// Composizione dell'email del mattino. Funzione pura: la usano la Edge
// Function (Deno) e i test (vitest).

export type VoceServizio = { id: string; nome: string; prossima_scadenza: string; giorni: number };
export type VoceTask = { id: string; titolo: string; scadenza: string | null; data_pianificata: string | null };
export type VoceRata = { id: string; debito_id: string; creditore: string; numero: number; scadenza: string; importo: number };

export type Digest = { oggetto: string; html: string; testo: string };

const euro = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" });

function data(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function quando(giorni: number): string {
  if (giorni < -1) return `scaduto da ${-giorni} giorni`;
  if (giorni === -1) return "scaduto ieri";
  if (giorni === 0) return "scade oggi";
  if (giorni === 1) return "scade domani";
  return `tra ${giorni} giorni`;
}

type Riga = { testo: string; dettaglio: string; link: string; urgente: boolean };

function sezione(titolo: string, righe: Riga[]) {
  if (righe.length === 0) return { html: "", testo: "" };
  const html = `
    <h2 style="font-size:15px;margin:24px 0 8px">${escapeHtml(titolo)}</h2>
    <table role="presentation" style="width:100%;border-collapse:collapse;font-size:14px">
      ${righe
        .map(
          (r) => `<tr>
        <td style="padding:6px 0;border-bottom:1px solid #eee">
          <a href="${escapeHtml(r.link)}" style="color:#111;text-decoration:none">${escapeHtml(r.testo)}</a>
        </td>
        <td style="padding:6px 0;border-bottom:1px solid #eee;text-align:right;white-space:nowrap;color:${r.urgente ? "#b91c1c" : "#555"}">
          ${escapeHtml(r.dettaglio)}
        </td>
      </tr>`,
        )
        .join("")}
    </table>`;
  const testo = `\n${titolo}\n${righe.map((r) => `- ${r.testo} (${r.dettaglio}): ${r.link}`).join("\n")}\n`;
  return { html, testo };
}

/** null se non c'è niente da segnalare: in quel caso l'email non si manda. */
export function componiDigest(input: {
  servizi: VoceServizio[];
  task: VoceTask[];
  rate: VoceRata[];
  oggi: string;
  siteUrl: string;
}): Digest | null {
  const { servizi, task, rate, oggi, siteUrl } = input;
  if (servizi.length + task.length + rate.length === 0) return null;
  const base = siteUrl.replace(/\/$/, "");

  const s = sezione(
    "Servizi in scadenza",
    [...servizi]
      .sort((a, b) => a.giorni - b.giorni)
      .map((v) => ({
        testo: v.nome,
        dettaglio: `${data(v.prossima_scadenza)} · ${quando(v.giorni)}`,
        link: `${base}/servizi?apri=servizio:${v.id}`,
        urgente: v.giorni <= 7,
      })),
  );
  const t = sezione(
    "Task in ritardo",
    task.map((v) => {
      const riferimento = v.scadenza && v.scadenza < oggi ? `scadenza ${data(v.scadenza)}` : `pianificata ${data(v.data_pianificata ?? oggi)}`;
      return { testo: v.titolo, dettaglio: riferimento, link: `${base}/task?apri=task:${v.id}`, urgente: true };
    }),
  );
  const r = sezione(
    "Rate in arrivo",
    [...rate]
      .sort((a, b) => a.scadenza.localeCompare(b.scadenza))
      .map((v) => ({
        testo: `${v.creditore} — rata ${v.numero}`,
        dettaglio: `${data(v.scadenza)} · ${euro.format(v.importo)}`,
        link: `${base}/budget?apri=debito:${v.debito_id}`,
        urgente: v.scadenza <= oggi,
      })),
  );

  const scaduti = servizi.filter((v) => v.giorni < 0).length;
  const parti = [
    servizi.length ? `${servizi.length} ${servizi.length === 1 ? "scadenza" : "scadenze"}` : null,
    task.length ? `${task.length} task in ritardo` : null,
    rate.length ? `${rate.length} ${rate.length === 1 ? "rata" : "rate"}` : null,
  ].filter(Boolean);
  const oggetto = `${scaduti > 0 ? "⚠️ " : ""}Milo Flow · ${parti.join(", ")}`;

  const html = `<!doctype html><html lang="it"><body style="margin:0;background:#f6f6f6">
  <div style="max-width:560px;margin:0 auto;padding:24px;font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#111;background:#fff">
    <p style="margin:0 0 4px;font-size:13px;color:#777">Riepilogo del ${data(oggi)}</p>
    <h1 style="font-size:18px;margin:0">Buongiorno, ecco cosa richiede attenzione</h1>
    ${s.html}${t.html}${r.html}
    <p style="margin:32px 0 0;font-size:12px;color:#999">Puoi cambiare orario o disattivare questo riepilogo da Impostazioni → Notifiche.</p>
  </div></body></html>`;
  const testo = `Riepilogo del ${data(oggi)}\n${s.testo}${t.testo}${r.testo}`;

  return { oggetto, html, testo };
}
