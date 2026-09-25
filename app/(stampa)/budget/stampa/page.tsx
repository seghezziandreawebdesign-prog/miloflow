import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { BarraStampa } from "@/components/budget/pulsante-stampa";
import { Contatore, Sezione, Vuoto } from "@/components/budget/stampa-parti";
import { getFiltroAmbito } from "@/lib/ambito.server";
import { ETICHETTE_AMBITO } from "@/lib/ambito";
import {
  abbonamentiAnnui,
  aggiungiMesi,
  etichettaCategoriaMovimento,
  fineDelMese,
  formatMese,
  primoDelMese,
  riepilogoDebiti,
  spesaPerMetodo,
  totaliMese,
  tipoDebito,
  statoDebito,
} from "@/lib/budget";
import { capitalize, formatCurrency, formatDate, todayISO } from "@/lib/dates/format";
import {
  leggiAbbonamenti,
  leggiBudgetMese,
  leggiCategorie,
  leggiDebiti,
  leggiMetodi,
  leggiMovimentiMese,
  permessiBudget,
} from "@/lib/queries/budget";
import { frequenza } from "@/lib/servizi";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Report mensile" };

/** Report del mese con tutto il dettaglio, impaginato per la stampa e il PDF. */
export default async function Page({ searchParams }: PageProps<"/budget/stampa">) {
  const params = await searchParams;
  const oggi = todayISO();
  const mese = primoDelMese(typeof params.mese === "string" && /^\d{4}-\d{2}-\d{2}$/.test(params.mese) ? params.mese : oggi);
  const [filtroAmbito, permessi] = await Promise.all([getFiltroAmbito(), permessiBudget()]);
  if (!permessi.lettura) redirect("/budget");

  const [movimenti, categorie, budgetMensili, debiti, servizi, metodi] = await Promise.all([
    leggiMovimentiMese(mese, filtroAmbito),
    leggiCategorie(),
    leggiBudgetMese(mese),
    leggiDebiti(filtroAmbito),
    leggiAbbonamenti(filtroAmbito),
    leggiMetodi(),
  ]);
  const totali = totaliMese(movimenti, categorie, budgetMensili, filtroAmbito);
  const pagati = movimenti.filter((m) => m.stato === "pagato");
  const perMetodo = spesaPerMetodo(movimenti, metodi);
  const abbonamenti = abbonamentiAnnui(servizi);
  const fine = fineDelMese(mese);
  const rateDelMese = debiti.flatMap((d) =>
    d.debiti_rate.filter((r) => r.scadenza >= mese && r.scadenza <= fine).map((r) => ({ ...r, creditore: d.creditore })),
  );
  const riepilogo = riepilogoDebiti(debiti, movimenti, oggi, 8);
  const ordinati = [...movimenti].sort((a, b) => a.data.localeCompare(b.data) || a.created_at.localeCompare(b.created_at));

  return (
    <>
      <BarraStampa indietro={`/budget?tab=mese&mese=${mese}`} />

      <header className="mb-6 border-b pb-4">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Milo Flow · Report mensile</p>
        <h1 className="text-2xl font-semibold tracking-tight">{capitalize(formatMese(mese))}</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Ambito: {ETICHETTE_AMBITO[filtroAmbito]} · dal {formatDate(mese)} al {formatDate(fine)} · generato il {formatDate(oggi)}
        </p>
      </header>

      <section className="mb-6">
        <dl className="grid grid-cols-4 gap-3">
          <Contatore label="Budget" valore={totali.budget} />
          <Contatore label="Speso" valore={totali.speso} />
          <Contatore label="Previsto da pagare" valore={totali.previsto} />
          <Contatore label="Rimanente" valore={totali.rimanente} negativo={totali.budget > 0 && totali.rimanente < 0} />
        </dl>
      </section>

      <Sezione titolo="Per categoria">
        {totali.barre.length === 0 ? (
          <Vuoto />
        ) : (
          <table className="w-full">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th className="py-1 font-medium">Categoria</th>
                <th className="py-1 text-right font-medium">Budget</th>
                <th className="py-1 text-right font-medium">Speso</th>
                <th className="py-1 text-right font-medium">Previsto</th>
                <th className="py-1 text-right font-medium">Rimanente</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {totali.barre.map((b) => (
                <tr key={b.categoria?.id ?? "senza"} className={cn("border-t", b.superato && "text-destructive")}>
                  <td className="py-1">
                    <span className="mr-1.5 inline-block size-2 rounded-full align-middle" style={{ backgroundColor: b.categoria?.colore ?? "#8e8e93" }} />
                    {b.categoria?.nome ?? "Senza categoria"}
                  </td>
                  <td className="py-1 text-right">{b.budget === null ? "—" : formatCurrency(b.budget)}</td>
                  <td className="py-1 text-right">{formatCurrency(b.speso)}</td>
                  <td className="py-1 text-right">{formatCurrency(b.previsto)}</td>
                  <td className="py-1 text-right">{b.budget === null ? "—" : formatCurrency(b.budget - b.speso - b.previsto)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Sezione>

      <Sezione titolo={`Movimenti (${movimenti.length})`}>
        {ordinati.length === 0 ? (
          <Vuoto />
        ) : (
          <table className="w-full">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th className="py-1 font-medium">Data</th>
                <th className="py-1 font-medium">Descrizione</th>
                <th className="py-1 font-medium">Categoria</th>
                <th className="py-1 font-medium">Metodo</th>
                <th className="py-1 font-medium">Stato</th>
                <th className="py-1 text-right font-medium">Importo</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {ordinati.map((m) => (
                <tr key={m.id} className={cn("border-t", m.stato === "previsto" && "text-muted-foreground")}>
                  <td className="py-1 whitespace-nowrap">{formatDate(m.data)}</td>
                  <td className="py-1">
                    {m.descrizione || "—"}
                    {m.servizio_id && <span className="text-xs text-muted-foreground"> · servizio</span>}
                    {m.rata_id && <span className="text-xs text-muted-foreground"> · rata {m.rata_numero}</span>}
                    <span className="ml-1 text-xs text-muted-foreground">{m.ambito === "personale" ? "P" : "L"}</span>
                  </td>
                  <td className="py-1">{etichettaCategoriaMovimento(m) ?? "—"}</td>
                  <td className="py-1">{m.metodo_nome ? (m.metodo_cifre ? `${m.metodo_nome} •${m.metodo_cifre}` : m.metodo_nome) : "—"}</td>
                  <td className="py-1">{m.stato === "pagato" ? "Pagato" : "Previsto"}</td>
                  <td className="py-1 text-right">{formatCurrency(m.importo)}</td>
                </tr>
              ))}
              <tr className="border-t font-medium">
                <td className="py-1" colSpan={5}>
                  Totale pagato
                </td>
                <td className="py-1 text-right">{formatCurrency(pagati.reduce((a, m) => a + m.importo, 0))}</td>
              </tr>
            </tbody>
          </table>
        )}
      </Sezione>

      <div className="grid grid-cols-2 gap-6">
        <Sezione titolo="Spesa per metodo">
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
      </div>

      <Sezione titolo="Debiti">
        {debiti.length === 0 ? (
          <Vuoto />
        ) : (
          <>
            <table className="w-full tabular-nums">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="py-1 font-medium">Creditore</th>
                  <th className="py-1 font-medium">Tipo</th>
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
                      <td className="py-1">{tipoDebito(d.tipo).label}</td>
                      <td className="py-1 text-right">{formatCurrency(d.importo_totale)}</td>
                      <td className="py-1 text-right">{formatCurrency(s.pagato)}</td>
                      <td className="py-1 text-right font-medium">{formatCurrency(s.residuo)}</td>
                      <td className="py-1 text-right">
                        {s.ratePagate}/{s.rateTotali}
                      </td>
                    </tr>
                  );
                })}
                <tr className="border-t font-medium">
                  <td className="py-1" colSpan={4}>
                    Residuo totale
                  </td>
                  <td className="py-1 text-right">{formatCurrency(riepilogo.residuo)}</td>
                  <td />
                </tr>
              </tbody>
            </table>
            {rateDelMese.length > 0 && (
              <>
                <p className="mt-3 mb-1 text-xs font-medium text-muted-foreground">Rate del mese</p>
                <table className="w-full tabular-nums">
                  <tbody>
                    {rateDelMese.map((r) => (
                      <tr key={r.id} className="border-t first:border-t-0">
                        <td className="py-1 whitespace-nowrap">{formatDate(r.scadenza)}</td>
                        <td className="py-1">
                          {r.creditore} · rata {r.numero}
                        </td>
                        <td className="py-1">{r.pagata ? "Pagata" : "Da pagare"}</td>
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
        Mese successivo: {capitalize(formatMese(aggiungiMesi(mese, 1)))} · I previsti sono le spese attese ma non ancora pagate.
      </footer>
    </>
  );
}

