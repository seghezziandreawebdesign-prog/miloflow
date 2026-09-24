"use client";

import { Landmark, Plus } from "lucide-react";
import { useState } from "react";

import { useApriEntita } from "@/components/drawer/use-apri-entita";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { ambitoDiDefault, type FiltroAmbito } from "@/lib/ambito";
import { statoDebito, tipoDebito } from "@/lib/budget";
import { formatCurrency, formatDate } from "@/lib/dates/format";
import type { DebitoRiga } from "@/lib/queries/budget";
import { debitoVuoto } from "@/lib/schemas/budget";
import { cn } from "@/lib/utils";

import { DebitoDialog } from "./debito-dialog";

export function DebitiView({
  debiti,
  oggi,
  filtroAmbito,
  scrittura,
}: {
  debiti: DebitoRiga[];
  oggi: string;
  filtroAmbito: FiltroAmbito;
  scrittura: boolean;
}) {
  const [nuovo, setNuovo] = useState(false);
  const apri = useApriEntita();
  const conStato = debiti.map((d) => ({ d, s: statoDebito(d, d.debiti_rate, oggi) }));
  const aperti = conStato.filter((x) => x.s.residuo > 0);
  const chiusi = conStato.filter((x) => x.s.residuo === 0);
  const residuoTotale = aperti.reduce((acc, x) => acc + x.s.residuo, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        {scrittura && (
          <Button onClick={() => setNuovo(true)}>
            <Plus />
            Nuovo debito
          </Button>
        )}
        {aperti.length > 0 && (
          <p className="text-sm text-muted-foreground">
            Residuo totale <span className="font-semibold text-foreground tabular-nums">{formatCurrency(residuoTotale)}</span>
          </p>
        )}
      </div>

      {debiti.length === 0 ? (
        <EmptyState
          icon={Landmark}
          title="Nessun debito"
          description="Finanziamenti, rate e prestiti: con il piano delle rate i previsti finiscono nel budget."
          action={
            scrittura ? (
              <Button onClick={() => setNuovo(true)}>
                <Plus />
                Nuovo debito
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <ul className="grid gap-3 sm:grid-cols-2">
            {aperti.map(({ d, s }) => (
              <li key={d.id}>
                <button
                  type="button"
                  onClick={() => apri({ tipo: "debito", id: d.id })}
                  className="block w-full rounded-xl bg-card p-4 text-left ring-1 ring-black/8 transition-colors hover:bg-muted/40"
                >
                  <div className="flex items-start gap-3">
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary-soft text-primary">
                      <Landmark className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{d.creditore}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {tipoDebito(d.tipo).label}
                        {d.descrizione && ` · ${d.descrizione}`}
                        <span className={`ml-1.5 inline-block size-1.5 rounded-full align-middle ${d.ambito === "personale" ? "bg-ambito-personale" : "bg-ambito-lavoro"}`} />
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold tabular-nums">{formatCurrency(s.residuo)}</p>
                      <p className="text-xs text-muted-foreground">residuo</p>
                    </div>
                  </div>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${s.avanzamento}%` }} />
                  </div>
                  <p className="mt-2 flex justify-between text-xs text-muted-foreground">
                    <span>
                      {s.rateTotali > 0 ? `${s.ratePagate}/${s.rateTotali} rate` : "Senza piano"}
                      {s.inRitardo > 0 && <span className="ml-1.5 font-medium text-destructive">{s.inRitardo} in ritardo</span>}
                    </span>
                    {s.prossima && (
                      <span className={cn(s.prossima.scadenza < oggi && "text-destructive")}>
                        Prossima {formatDate(s.prossima.scadenza)} · {formatCurrency(s.prossima.importo)}
                      </span>
                    )}
                  </p>
                </button>
              </li>
            ))}
          </ul>
          {chiusi.length > 0 && (
            <section>
              <h3 className="mb-1.5 px-1 text-xs font-medium text-muted-foreground">Estinti</h3>
              <ul className="divide-y rounded-xl bg-card ring-1 ring-black/8">
                {chiusi.map(({ d, s }) => (
                  <li key={d.id}>
                    <button type="button" onClick={() => apri({ tipo: "debito", id: d.id })} className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm">
                      <span className="min-w-0 flex-1 truncate">{d.creditore}</span>
                      <span className="text-muted-foreground tabular-nums">{formatCurrency(s.pagato)} pagati</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      {nuovo && (
        <DebitoDialog open onOpenChange={(o) => !o && setNuovo(false)} defaultValues={debitoVuoto(ambitoDiDefault(filtroAmbito), oggi)} />
      )}
    </div>
  );
}
