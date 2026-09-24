"use client";

import { BarChart3 } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, XAxis, YAxis } from "recharts";

import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import type { FiltroAmbito } from "@/lib/ambito";
import {
  formatMeseBreve,
  PERIODI_REPORT,
  type FettaCategoria,
  type MargineCliente,
  type PeriodoReport,
  type PuntoMensile,
  type ServizioAbbonamento,
  type SpesaMetodo,
} from "@/lib/budget";
import { formatCurrency, formatDate } from "@/lib/dates/format";
import { frequenza } from "@/lib/servizi";
import { cn } from "@/lib/utils";

const GRIGIO = "#8e8e93";
const CONFIG_MESI = {
  lavoro: { label: "Lavoro", color: "var(--ambito-lavoro)" },
  personale: { label: "Personale", color: "var(--ambito-personale)" },
} satisfies ChartConfig;

export function ReportView({
  periodo,
  intervallo,
  filtroAmbito,
  perCategoria,
  perMese,
  fisseVariabili,
  abbonamenti,
  margini,
  perMetodo,
  totaleMovimenti,
}: {
  periodo: PeriodoReport;
  intervallo: { dal: string; al: string };
  filtroAmbito: FiltroAmbito;
  perCategoria: FettaCategoria[];
  perMese: PuntoMensile[];
  fisseVariabili: { fisse: number; variabili: number };
  abbonamenti: { totale: number; mensile: number; elenco: (ServizioAbbonamento & { annuo: number })[] };
  margini: MargineCliente[];
  perMetodo: SpesaMetodo[];
  totaleMovimenti: number;
}) {
  const etichettaPeriodo = PERIODI_REPORT.find((p) => p.value === periodo)?.label ?? "";
  const totale = perCategoria.reduce((acc, f) => acc + f.totale, 0);
  const totaleFV = fisseVariabili.fisse + fisseVariabili.variabili;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {etichettaPeriodo}: dal {formatDate(intervallo.dal)} al {formatDate(intervallo.al)} · {totaleMovimenti} movimenti pagati ·{" "}
        <span className="font-medium text-foreground tabular-nums">{formatCurrency(totale)}</span>
      </p>

      <div className="grid gap-4 lg:grid-cols-2">
        <Riquadro titolo="Per categoria" sottotitolo="Spese pagate nel periodo.">
          {perCategoria.length === 0 ? (
            <Vuoto />
          ) : (
            <div className="flex flex-col items-center gap-4 sm:flex-row">
              <ChartContainer config={{}} className="aspect-square w-44 shrink-0">
                <PieChart>
                  <ChartTooltip content={<ChartTooltipContent nameKey="nome" formatter={(v) => formatCurrency(Number(v))} hideIndicator />} />
                  <Pie data={perCategoria} dataKey="totale" nameKey="nome" innerRadius={48} outerRadius={80} paddingAngle={2} strokeWidth={0}>
                    {perCategoria.map((f) => (
                      <Cell key={f.id ?? "senza"} fill={f.colore ?? GRIGIO} />
                    ))}
                  </Pie>
                </PieChart>
              </ChartContainer>
              <ul className="w-full min-w-0 flex-1 space-y-1.5 text-sm">
                {perCategoria.map((f) => (
                  <li key={f.id ?? "senza"} className="flex items-center gap-2">
                    <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: f.colore ?? GRIGIO }} />
                    <span className="min-w-0 flex-1 truncate">{f.nome}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">{totale > 0 ? Math.round((f.totale / totale) * 100) : 0}%</span>
                    <span className="w-24 text-right tabular-nums">{formatCurrency(f.totale)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Riquadro>

        <Riquadro titolo="Ultimi 12 mesi" sottotitolo="Lavoro e personale, spese pagate.">
          {perMese.every((p) => p.lavoro === 0 && p.personale === 0) ? (
            <Vuoto />
          ) : (
            <>
              <ChartContainer config={CONFIG_MESI} className="h-56 w-full">
                <BarChart data={perMese} margin={{ left: 0, right: 8, top: 8 }}>
                  <defs>
                    <pattern id="tratteggio-personale" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
                      <rect width="6" height="6" fill="var(--ambito-personale)" />
                      <line x1="0" y1="0" x2="0" y2="6" stroke="#fff" strokeWidth="2" strokeOpacity="0.55" />
                    </pattern>
                  </defs>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="mese" tickLine={false} axisLine={false} tickMargin={6} tickFormatter={(m: string) => formatMeseBreve(m)} fontSize={11} />
                  <YAxis tickLine={false} axisLine={false} width={44} fontSize={11} tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 100) / 10}k` : String(v))} />
                  <ChartTooltip content={<ChartTooltipContent labelFormatter={(m) => formatMeseBreve(String(m), true)} formatter={(v, name) => [formatCurrency(Number(v)), CONFIG_MESI[name as keyof typeof CONFIG_MESI].label]} />} />
                  <ChartLegend content={<ChartLegendContent />} />
                  {filtroAmbito !== "personale" && <Bar dataKey="lavoro" stackId="a" fill="var(--ambito-lavoro)" radius={[0, 0, 0, 0]} />}
                  {filtroAmbito !== "lavoro" && <Bar dataKey="personale" stackId="a" fill="url(#tratteggio-personale)" radius={[4, 4, 0, 0]} />}
                </BarChart>
              </ChartContainer>
              <details className="mt-2 text-xs">
                <summary className="cursor-pointer text-muted-foreground">Vedi la tabella</summary>
                <table className="mt-2 w-full">
                  <thead className="text-muted-foreground">
                    <tr>
                      <th className="py-1 text-left font-medium">Mese</th>
                      <th className="py-1 text-right font-medium">Lavoro</th>
                      <th className="py-1 text-right font-medium">Personale</th>
                      <th className="py-1 text-right font-medium">Totale</th>
                    </tr>
                  </thead>
                  <tbody className="tabular-nums">
                    {perMese.map((p) => (
                      <tr key={p.mese}>
                        <td className="py-0.5">{formatMeseBreve(p.mese, true)}</td>
                        <td className="py-0.5 text-right">{formatCurrency(p.lavoro)}</td>
                        <td className="py-0.5 text-right">{formatCurrency(p.personale)}</td>
                        <td className="py-0.5 text-right font-medium">{formatCurrency(p.lavoro + p.personale)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </details>
            </>
          )}
        </Riquadro>

        <Riquadro titolo="Fisse e variabili" sottotitolo="Fisse: servizi e rate. Variabili: tutto il resto.">
          {totaleFV === 0 ? (
            <Vuoto />
          ) : (
            <div className="space-y-3">
              <div className="flex h-3 overflow-hidden rounded-full bg-muted" role="img" aria-label={`Fisse ${formatCurrency(fisseVariabili.fisse)}, variabili ${formatCurrency(fisseVariabili.variabili)}`}>
                <div className="h-full bg-primary" style={{ width: `${(fisseVariabili.fisse / totaleFV) * 100}%` }} />
                <div className="ml-0.5 h-full bg-chart-3" style={{ width: `${(fisseVariabili.variabili / totaleFV) * 100}%` }} />
              </div>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <Voce label="Fisse" colore="bg-primary" valore={fisseVariabili.fisse} quota={fisseVariabili.fisse / totaleFV} />
                <Voce label="Variabili" colore="bg-chart-3" valore={fisseVariabili.variabili} quota={fisseVariabili.variabili / totaleFV} />
              </dl>
            </div>
          )}
        </Riquadro>

        <Riquadro titolo="Spesa per carta e metodo" sottotitolo="Con cosa hai pagato nel periodo.">
          {perMetodo.length === 0 ? (
            <Vuoto />
          ) : (
            <ul className="space-y-1.5 text-sm">
              {perMetodo.map((m) => (
                <li key={m.id ?? "nessuno"} className="flex items-center gap-2">
                  <span className={cn("min-w-0 flex-1 truncate", m.id === null && "text-muted-foreground")}>{m.nome}</span>
                  <span className="text-xs text-muted-foreground">{m.movimenti} {m.movimenti === 1 ? "movimento" : "movimenti"}</span>
                  <span className="w-24 text-right tabular-nums">{formatCurrency(m.totale)}</span>
                </li>
              ))}
            </ul>
          )}
        </Riquadro>

        <Riquadro titolo="Abbonamenti attivi" sottotitolo="Servizi che paghi tu, normalizzati su 12 mesi.">
          {abbonamenti.elenco.length === 0 ? (
            <Vuoto />
          ) : (
            <div className="space-y-3">
              <p className="text-sm">
                <span className="text-2xl font-semibold tabular-nums tracking-tight">{formatCurrency(abbonamenti.totale)}</span>
                <span className="text-muted-foreground"> all&apos;anno · {formatCurrency(abbonamenti.mensile)} al mese</span>
              </p>
              <ul className="space-y-1.5 text-sm">
                {abbonamenti.elenco.map((s) => (
                  <li key={s.id} className="flex items-center gap-2">
                    <span className={`size-1.5 shrink-0 rounded-full ${s.ambito === "personale" ? "bg-ambito-personale" : "bg-ambito-lavoro"}`} />
                    <span className="min-w-0 flex-1 truncate">{s.nome}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatCurrency(s.costo ?? 0)} {frequenza(s.frequenza).label.toLowerCase()}
                    </span>
                    <span className="w-24 text-right tabular-nums">{formatCurrency(s.annuo)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Riquadro>

        {filtroAmbito !== "personale" && (
          <Riquadro titolo="Margine sui servizi rivenduti" sottotitolo="Prezzi di rivendita meno costi, per cliente, su 12 mesi.">
            {margini.length === 0 ? (
              <Vuoto testo="Nessun servizio rivenduto: imposta i prezzi di rivendita nei servizi." />
            ) : (
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground">
                  <tr>
                    <th className="py-1 text-left font-medium">Cliente</th>
                    <th className="py-1 text-right font-medium">Rivendita</th>
                    <th className="py-1 text-right font-medium">Costo</th>
                    <th className="py-1 text-right font-medium">Margine</th>
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  {margini.map((m) => (
                    <tr key={m.cliente_id} className="border-t">
                      <td className="py-1.5">
                        {m.cliente} <span className="text-xs text-muted-foreground">({m.servizi})</span>
                      </td>
                      <td className="py-1.5 text-right">{formatCurrency(m.rivendita)}</td>
                      <td className="py-1.5 text-right text-muted-foreground">{formatCurrency(m.costo)}</td>
                      <td className={cn("py-1.5 text-right font-medium", m.margine < 0 && "text-destructive")}>{formatCurrency(m.margine)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Riquadro>
        )}
      </div>
    </div>
  );
}

function Riquadro({ titolo, sottotitolo, children }: { titolo: string; sottotitolo?: string; children: React.ReactNode }) {
  return (
    <section className="min-w-0 overflow-hidden rounded-xl bg-card p-4 ring-1 ring-black/8">
      <h3 className="font-semibold">{titolo}</h3>
      {sottotitolo && <p className="mb-3 text-xs text-muted-foreground">{sottotitolo}</p>}
      {children}
    </section>
  );
}

function Vuoto({ testo = "Niente da mostrare per questo periodo." }: { testo?: string }) {
  return (
    <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
      <BarChart3 className="size-4" />
      {testo}
    </div>
  );
}

function Voce({ label, colore, valore, quota }: { label: string; colore: string; valore: number; quota: number }) {
  return (
    <div className="flex items-start gap-2">
      <span className={cn("mt-1.5 size-2.5 shrink-0 rounded-full", colore)} />
      <div>
        <dt className="text-xs text-muted-foreground">
          {label} · {Math.round(quota * 100)}%
        </dt>
        <dd className="font-medium tabular-nums">{formatCurrency(valore)}</dd>
      </div>
    </div>
  );
}

