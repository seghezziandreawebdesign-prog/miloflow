"use client";

import { Plus, RefreshCw } from "lucide-react";
import { useState } from "react";

import { useApriEntita } from "@/components/drawer/use-apri-entita";
import { EmptyState } from "@/components/empty-state";
import { ServizioDialog } from "@/components/servizi/servizio-dialog";
import { StatoScadenzaBadge } from "@/components/servizi/stato-scadenza-badge";
import { TipoIcona } from "@/components/tipo-icona";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/dates/format";
import type { ServizioLista } from "@/lib/queries/servizi";
import { servizioVuoto } from "@/lib/schemas/servizi";
import { costoAnnuo, frequenza, type StatoScadenza } from "@/lib/servizi";
import { cn } from "@/lib/utils";

export function ServiziCliente({
  clienteId,
  servizi,
  mostraCosti,
}: {
  clienteId: string;
  servizi: ServizioLista[];
  mostraCosti: boolean;
}) {
  const apri = useApriEntita();
  const [nuovo, setNuovo] = useState(false);
  const attivi = servizi.filter((s) => s.stato === "attivo");

  // Totali annui sui servizi attivi: quanto costano e quanto rendono con questo cliente.
  const costoTot = attivi.reduce((t, s) => t + costoAnnuo(s.costo, s.frequenza ?? "annuale"), 0);
  const rivenditaTot = attivi.reduce((t, s) => {
    const prezzo = s.clienti.find((c) => c.id === clienteId)?.prezzo_rivendita;
    return t + costoAnnuo(prezzo ?? null, s.frequenza ?? "annuale");
  }, 0);

  const dialog = (
    <ServizioDialog
      open={nuovo}
      onOpenChange={setNuovo}
      defaultValues={{ ...servizioVuoto("lavoro", ""), clienti: [{ cliente_id: clienteId, prezzo_rivendita: "" }] }}
      onSaved={(id) => apri({ tipo: "servizio", id })}
    />
  );

  if (servizi.length === 0) {
    return (
      <>
        <EmptyState
          icon={RefreshCw}
          title="Nessun servizio collegato"
          description="Domini, hosting e licenze di questo cliente, con costi, prezzi di rivendita e scadenze."
          action={
            <Button onClick={() => setNuovo(true)}>
              <Plus />
              Aggiungi un servizio
            </Button>
          }
        />
        {dialog}
      </>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        {mostraCosti ? (
          <dl className="flex flex-wrap gap-6 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">Costo annuo</dt>
              <dd className="font-medium tabular-nums">{formatCurrency(costoTot)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Rivendita annua</dt>
              <dd className="font-medium tabular-nums">{formatCurrency(rivenditaTot)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Margine annuo</dt>
              <dd className={cn("font-medium tabular-nums", rivenditaTot - costoTot >= 0 ? "text-emerald-700" : "text-red-700")}>
                {formatCurrency(rivenditaTot - costoTot)}
              </dd>
            </div>
          </dl>
        ) : (
          <span />
        )}
        <Button variant="outline" onClick={() => setNuovo(true)}>
          <Plus />
          Nuovo servizio
        </Button>
      </div>

      <ul className="divide-y overflow-hidden rounded-xl bg-card ring-1 ring-black/8">
        {servizi.map((s) => {
          const prezzo = s.clienti.find((c) => c.id === clienteId)?.prezzo_rivendita ?? null;
          return (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => apri({ tipo: "servizio", id: s.id })}
                className="grid w-full grid-cols-[1fr_auto] items-center gap-3 px-4 py-3 text-left hover:bg-muted/50 sm:grid-cols-[1fr_9rem_auto]"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <TipoIcona nome={s.tipo_icona} className="size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="truncate font-medium">{s.nome}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(s.prossima_scadenza ?? "")} · {frequenza(s.frequenza ?? "annuale").label}
                      {s.chi_paga === "cliente" && " · paga il cliente"}
                    </p>
                  </div>
                </div>
                <div className="hidden sm:block">
                  {s.stato === "attivo" ? (
                    <StatoScadenzaBadge stato={s.stato_scadenza as StatoScadenza} giorni={s.giorni_alla_scadenza ?? 0} />
                  ) : (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs capitalize text-muted-foreground">{s.stato}</span>
                  )}
                </div>
                {mostraCosti && (
                  <div className="text-right text-sm tabular-nums">
                    <p>{s.costo === null ? "—" : formatCurrency(s.costo)}</p>
                    {prezzo !== null && (
                      <p className="text-xs text-muted-foreground">rivenduto a {formatCurrency(prezzo)}</p>
                    )}
                  </div>
                )}
              </button>
            </li>
          );
        })}
      </ul>
      {dialog}
    </div>
  );
}
