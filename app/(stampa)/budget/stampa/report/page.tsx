import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { BarraStampa } from "@/components/budget/pulsante-stampa";
import { Contatore, Sezione, Vuoto } from "@/components/budget/stampa-parti";
import { getFiltroAmbito } from "@/lib/ambito.server";
import { ETICHETTE_AMBITO } from "@/lib/ambito";
import {
  abbonamentiAnnui,
  fineDelMese,
  fisseVsVariabili,
  formatMeseBreve,
  leggiPeriodoReport,
  marginePerCliente,
  meseFinaleReport,
  PERIODI_REPORT,
  riepilogoDebiti,
  spesaPerCategoria,
  spesaPerMese,
  spesaPerMetodo,
  statoDebito,
  ultimiMesi,
} from "@/lib/budget";
import { formatCurrency, formatDate, todayISO } from "@/lib/dates/format";
import {
  leggiAbbonamenti,
  leggiCategorie,
  leggiDebiti,
  leggiMetodi,
  leggiMovimentiPeriodo,
  leggiRivendite,
  permessiBudget,
} from "@/lib/queries/budget";
import { frequenza } from "@/lib/servizi";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Report del periodo" };

const GRIGIO = "#8e8e93";

/** Report del periodo scelto nella tab Report, impaginato per la stampa e il PDF. */
export default async function Page({ searchParams }: PageProps<"/budget/stampa/report">) {
  const params = await searchParams;
  const oggi = todayISO();
  const report = leggiPeriodoReport(params, oggi);
  const [filtroAmbito, permessi] = await Promise.all([getFiltroAmbito(), permessiBudget()]);
  if (!permessi.lettura) redirect("/budget");

  const { dal, al } = report;
  const mesi = ultimiMesi(meseFinaleReport(report, oggi), 12);
  const [movimenti, dodiciMesi, categorie, metodi, servizi, rivendite, debiti] = await Promise.all([
    leggiMovimentiPeriodo(dal, al, filtroAmbito),
    leggiMovimentiPeriodo(mesi[0], fineDelMese(mesi[11]), filtroAmbito),
    leggiCategorie(),
    leggiMetodi(),
    leggiAbbonamenti(filtroAmbito),
    filtroAmbito === "personale" ? Promise.resolve([]) : leggiRivendite(),
    leggiDebiti(filtroAmbito),
  ]);

  const perCategoria = spesaPerCategoria(movimenti, categorie);
  const totale = perCategoria.reduce((acc, f) => acc + f.totale, 0);
  const perMese = spesaPerMese(dodiciMesi, mesi);
  const fv = fisseVsVariabili(movimenti);
  const perMetodo = spesaPerMetodo(movimenti, metodi);
  const abbonamenti = abbonamentiAnnui(servizi);
  const margini = marginePerCliente(rivendite);
  const riepilogo = riepilogoDebiti(debiti, movimenti, oggi, 8);
  const etichettaPeriodo = PERIODI_REPORT.find((p) => p.value === report.periodo)?.label ?? "Periodo";
  const parametri = new URLSearchParams(
    report.periodo === "personalizzato" ? { tab: "report", periodo: report.periodo, dal, al } : { tab: "report", periodo: report.periodo },
  );

  return (
    <>
      <BarraStampa indietro={`/budget?${parametri.toString()}`} />

      <header className="mb-6 border-b pb-4">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Milo Flow · Report</p>
        <h1 className="text-2xl font-semibold tracking-tight">{etichettaPeriodo}</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Ambito: {ETICHETTE_AMBITO[filtroAmbito]} · dal {formatDate(dal)} al {formatDate(al)} · generato il {formatDate(oggi)} · spese
          pagate
        </p>
      </header>

      <section className="mb-6">
        <dl className="grid grid-cols-4 gap-3">
          <Contatore label="Speso nel periodo" valore={totale} />
          <Contatore label="Spese fisse" valore={fv.fisse} />
          <Contatore label="Spese variabili" valore={fv.variabili} />
          <Contatore label="Residuo debiti" valore={riepilogo.residuo} />
        </dl>
      </section>

      <Sezione titolo={`Per categoria (${movimenti.length} movimenti)`}>
        {perCategoria.length === 0 ? (
          <Vuoto />
        ) : (
          <table className="w-full tabular-nums">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th className="py-1 font-medium">Categoria</th>
                <th className="py-1 text-right font-medium">Quota</th>
                <th className="py-1 text-right font-medium">Totale</th>
              </tr>
            </thead>
            <tbody>
              {perCategoria.map((f) => (
                <tr key={f.id ?? "senza"} className="border-t">
                  <td className="py-1">
                    <span className="mr-1.5 inline-block size-2 rounded-full align-middle" style={{ backgroundColor: f.colore ?? GRIGIO }} />
                    {f.nome}
                  </td>
                  <td className="py-1 text-right">{totale > 0 ? Math.round((f.totale / totale) * 100) : 0}%</td>
                  <td className="py-1 text-right">{formatCurrency(f.totale)}</td>
                </tr>
              ))}
              <tr className="border-t font-medium">
                <td className="py-1" colSpan={2}>
                  Totale
                </td>
                <td className="py-1 text-right">{formatCurrency(totale)}</td>
              </tr>
            </tbody>
          </table>
        )}
      </Sezione>

      <div className="grid grid-cols-2 gap-6">
        <Sezione titolo="Ultimi 12 mesi">
          <table className="w-full tabular-nums">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th className="py-1 font-medium">Mese</th>
                {filtroAmbito !== "personale" && <th className="py-1 text-right font-medium">Lavoro</th>}
                {filtroAmbito !== "lavoro" && <th className="py-1 text-right font-medium">Personale</th>}
                <th className="py-1 text-right font-medium">Totale</th>
              </tr>
            </thead>
            <tbody>
              {perMese.map((p) => (
                <tr key={p.mese} className="border-t">
                  <td className="py-1">{formatMeseBreve(p.mese, true)}</td>
                  {filtroAmbito !== "personale" && <td className="py-1 text-right">{formatCurrency(p.lavoro)}</td>}
                  {filtroAmbito !== "lavoro" && <td className="py-1 text-right">{formatCurrency(p.personale)}</td>}
                  <td className="py-1 text-right font-medium">{formatCurrency(p.lavoro + p.personale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Sezione>

        <Sezione titolo="Spesa per carta e metodo">
          {perMetodo.length === 0 ? (
            <Vuoto />
          ) : (
            <table className="w-full tabular-nums">
              <tbody>
                {perMetodo.map((m) => (
                  <tr key={m.id ?? "nessuno"} className="border-t first:border-t-0">
                    <td className="py-1">{m.nome}</td>
                    <td className="py-1 text-right text-xs text-muted-foreground">{m.movimenti}</td>
                    <td className="py-1 text-right">{formatCurrency(m.totale)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Sezione>
      </div>

      <Sezione titolo="Abbonamenti attivi">
        {abbonamenti.elenco.length === 0 ? (
          <Vuoto />
        ) : (
          <>
            <p className="mb-1 text-xs text-muted-foreground">
              {formatCurrency(abbonamenti.totale)} all&apos;anno · {formatCurrency(abbonamenti.mensile)} al mese
            </p>
            <table className="w-full tabular-nums">
              <tbody>
                {abbonamenti.elenco.map((s) => (
                  <tr key={s.id} className="border-t first:border-t-0">
                    <td className="py-1">{s.nome}</td>
                    <td className="py-1 text-right text-xs text-muted-foreground">
                      {formatCurrency(s.costo ?? 0)} {frequenza(s.frequenza).label.toLowerCase()}
                    </td>
                    <td className="py-1 text-right">{formatCurrency(s.annuo)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </Sezione>

      {filtroAmbito !== "personale" && (
        <Sezione titolo="Margine sui servizi rivenduti">
          {margini.length === 0 ? (
            <Vuoto />
          ) : (
            <table className="w-full tabular-nums">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="py-1 font-medium">Cliente</th>
                  <th className="py-1 text-right font-medium">Servizi</th>
                  <th className="py-1 text-right font-medium">Rivendita</th>
                  <th className="py-1 text-right font-medium">Costo</th>
                  <th className="py-1 text-right font-medium">Margine</th>
                </tr>
              </thead>
              <tbody>
                {margini.map((m) => (
                  <tr key={m.cliente_id} className="border-t">
                    <td className="py-1">{m.cliente}</td>
                    <td className="py-1 text-right">{m.servizi}</td>
                    <td className="py-1 text-right">{formatCurrency(m.rivendita)}</td>
                    <td className="py-1 text-right">{formatCurrency(m.costo)}</td>
                    <td className={cn("py-1 text-right font-medium", m.margine < 0 && "text-destructive")}>{formatCurrency(m.margine)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Sezione>
      )}

      <Sezione titolo="Debiti">
        {debiti.length === 0 ? (
          <Vuoto />
        ) : (
          <>
            <p className="mb-1 text-xs text-muted-foreground">
              Residuo di oggi {formatCurrency(riepilogo.residuo)} · rate pagate nel periodo {riepilogo.pagate.numero} (
              {formatCurrency(riepilogo.pagate.totale)})
            </p>
            <table className="w-full tabular-nums">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="py-1 font-medium">Creditore</th>
                  <th className="py-1 text-right font-medium">Totale</th>
                  <th className="py-1 text-right font-medium">Pagato</th>
                  <th className="py-1 text-right font-medium">Residuo</th>
                  <th className="py-1 text-right font-medium">Rate</th>
                </tr>
              </thead>
              <tbody>
                {debiti.map((d) => {
                  const s = statoDebito(d, d.debiti_rate, oggi);
                  return (
                    <tr key={d.id} className="border-t">
                      <td className="py-1">{d.creditore}</td>
                      <td className="py-1 text-right">{formatCurrency(d.importo_totale)}</td>
                      <td className="py-1 text-right">{formatCurrency(s.pagato)}</td>
                      <td className="py-1 text-right font-medium">{formatCurrency(s.residuo)}</td>
                      <td className="py-1 text-right">
                        {s.ratePagate}/{s.rateTotali}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {riepilogo.prossime.length > 0 && (
              <>
                <p className="mt-3 mb-1 text-xs font-medium text-muted-foreground">Prossime rate</p>
                <table className="w-full tabular-nums">
                  <tbody>
                    {riepilogo.prossime.map((r) => (
                      <tr key={`${r.debito_id}-${r.numero}`} className="border-t first:border-t-0">
                        <td className="py-1 whitespace-nowrap">{formatDate(r.scadenza)}</td>
                        <td className="py-1">
                          {r.creditore} · rata {r.numero}
                        </td>
                        <td className="py-1 text-right">{formatCurrency(r.importo)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </>
        )}
      </Sezione>

      <footer className="mt-8 border-t pt-3 text-xs text-muted-foreground">
        I totali sono le spese pagate del periodo, come nella tab Report; gli abbonamenti e i debiti fotografano la situazione di oggi.
      </footer>
    </>
  );
}
