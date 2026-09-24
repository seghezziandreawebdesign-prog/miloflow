import { Landmark, Wallet } from "lucide-react";
import Link from "next/link";

import { CategoriaIcona } from "@/components/budget/categoria-icona";
import type { Movimento, TotaliMese } from "@/lib/budget";
import { formatCurrency, formatGiornoRelativo } from "@/lib/dates/format";
import { formatApri } from "@/lib/entita";
import { cn } from "@/lib/utils";

import { Blocco } from "./blocco";

/** Budget del mese: speso e previsto rispetto al budget totale. */
export function BloccoBudgetMese({ totali, mese }: { totali: TotaliMese; mese: string }) {
  const impegnato = totali.speso + totali.previsto;
  const pct = (v: number) => (totali.budget > 0 ? Math.min(100, (v / totali.budget) * 100) : 0);
  const sfora = totali.budget > 0 && impegnato > totali.budget;
  return (
    <Blocco titolo="Budget del mese" icona={Wallet} link={{ href: `/budget?tab=mese&mese=${mese}`, label: "Budget" }}>
      <div className="flex items-baseline justify-between text-sm">
        <span>
          <span className={cn("text-xl font-semibold tabular-nums tracking-tight", sfora && "text-destructive")}>{formatCurrency(totali.speso)}</span>
          {totali.previsto > 0 && <span className="text-muted-foreground"> + {formatCurrency(totali.previsto)} previsti</span>}
        </span>
        {totali.budget > 0 && <span className="text-muted-foreground tabular-nums">su {formatCurrency(totali.budget)}</span>}
      </div>
      {totali.budget > 0 && (
        <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-muted" role="img" aria-label={`Speso ${formatCurrency(totali.speso)}, previsto ${formatCurrency(totali.previsto)}, budget ${formatCurrency(totali.budget)}`}>
          <div className={cn("h-full rounded-l-full", sfora ? "bg-destructive" : "bg-primary")} style={{ width: `${pct(totali.speso)}%` }} />
          <div className={cn("h-full opacity-50", sfora ? "bg-destructive" : "bg-primary")} style={{ width: `${pct(totali.previsto)}%` }} />
        </div>
      )}
      <p className="mt-1.5 text-xs text-muted-foreground">
        {totali.budget > 0
          ? sfora
            ? `Oltre il budget di ${formatCurrency(impegnato - totali.budget)}`
            : `Rimangono ${formatCurrency(totali.rimanente)}`
          : "Nessun budget impostato: lo imposti nelle categorie."}
      </p>
    </Blocco>
  );
}

/** Rate e spese previste nei prossimi giorni. Si nasconde se vuoto. */
export function BloccoPrevisti({ previsti, oggi }: { previsti: Movimento[]; oggi: string }) {
  if (previsti.length === 0) return null;
  const totale = previsti.reduce((acc, m) => acc + m.importo, 0);
  return (
    <Blocco titolo="Rate e spese previste" icona={Landmark} descrizione={`Nei prossimi 7 giorni: ${formatCurrency(totale)}.`} link={{ href: "/budget?tab=mese", label: "Budget" }}>
      <ul className="-mx-2">
        {previsti.map((m) => {
          const ritardo = m.data < oggi;
          return (
            <li key={m.id}>
              <Link href={{ pathname: "/oggi", query: { apri: formatApri({ tipo: "movimento", id: m.id }) } }} scroll={false} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-muted/60">
                <CategoriaIcona nome={m.categoria_icona} colore={m.categoria_colore} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">{m.descrizione || m.categoria_nome || "Spesa prevista"}</span>
                  <span className={cn("block text-xs text-muted-foreground", ritardo && "font-medium text-destructive")}>
                    {ritardo ? "Scaduta" : formatGiornoRelativo(m.data, oggi)}
                    {m.rata_id && " · rata"}
                    {m.servizio_id && " · rinnovo"}
                  </span>
                </span>
                <span className="text-sm tabular-nums">{formatCurrency(m.importo)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </Blocco>
  );
}
