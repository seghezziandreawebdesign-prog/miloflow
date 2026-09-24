import { CalendarDays, MapPin, RefreshCw, RotateCw, Video } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { AmbitoBadge } from "@/components/ambito-badge";
import { Blocco } from "@/components/oggi/blocco";
import { BloccoDaSollecitare, BloccoTaskOggi } from "@/components/oggi/blocchi-task";
import { PageHeader } from "@/components/page-header";
import { StatoScadenzaBadge } from "@/components/servizi/stato-scadenza-badge";
import { TipoIcona } from "@/components/tipo-icona";
import { getFiltroAmbito } from "@/lib/ambito.server";
import { capitalize, formatDate, formatLongDate, todayISO } from "@/lib/dates/format";
import { formatApri } from "@/lib/entita";
import { eventiDiOggi, serviziInScadenza, type EventoDiOggi, type ServizioInScadenza } from "@/lib/queries/oggi";
import type { StatoScadenza } from "@/lib/servizi";

export const metadata: Metadata = { title: "Oggi" };

// I blocchi di budget, rate e spese previste arrivano con la fase 5.
export default async function Page() {
  const filtroAmbito = await getFiltroAmbito();
  const oggi = todayISO();
  const [eventi, servizi] = await Promise.all([eventiDiOggi(oggi, filtroAmbito), serviziInScadenza(oggi, filtroAmbito)]);

  return (
    <>
      <PageHeader
        title="Oggi"
        description={
          <>
            {capitalize(formatLongDate(oggi))} · Ambito: <AmbitoBadge ambito={filtroAmbito} className="align-middle" />
          </>
        }
      />
      <div className="grid items-start gap-4 lg:grid-cols-5">
        <div className="space-y-4 lg:col-span-3">
          <Suspense>
            <BloccoTaskOggi filtroAmbito={filtroAmbito} />
          </Suspense>
        </div>
        <div className="space-y-4 lg:col-span-2">
          <BloccoEventi eventi={eventi} />
          <BloccoServizi servizi={servizi} />
          <Suspense>
            <BloccoDaSollecitare filtroAmbito={filtroAmbito} />
          </Suspense>
        </div>
      </div>
    </>
  );
}

function hrefApri(tipo: "evento" | "servizio", id: string) {
  return { pathname: "/oggi", query: { apri: formatApri({ tipo, id }) } };
}

function BloccoEventi({ eventi }: { eventi: EventoDiOggi[] }) {
  return (
    <Blocco titolo="Eventi di oggi" icona={CalendarDays}>
      {eventi.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nessun evento oggi.</p>
      ) : (
        <ul className="-mx-2">
          {eventi.map((e) => (
            <li key={`${e.id}-${e.ora ?? ""}`}>
              <Link
                href={hrefApri("evento", e.id)}
                scroll={false}
                className="flex items-start gap-3 rounded-lg px-2 py-2 hover:bg-muted/60"
              >
                <span className="w-12 shrink-0 pt-px text-sm font-medium tabular-nums">{e.ora ?? "—"}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 text-sm">
                    <span
                      className={`size-2 shrink-0 rounded-full ${e.ambito === "personale" ? "bg-ambito-personale" : "bg-ambito-lavoro"}`}
                    />
                    <span className="truncate">{e.titolo}</span>
                    {e.ricorrenza && <RotateCw className="size-3 shrink-0 text-muted-foreground" aria-label="Ricorrente" />}
                  </span>
                  <span className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                    {e.tutto_il_giorno ? <span>Tutto il giorno</span> : e.oraFine && <span>fino alle {e.oraFine}</span>}
                    {e.luogo && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="size-3" />
                        {e.luogo}
                      </span>
                    )}
                    {e.link_call && (
                      <span className="inline-flex items-center gap-1">
                        <Video className="size-3" />
                        Call
                      </span>
                    )}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Blocco>
  );
}

function BloccoServizi({ servizi }: { servizi: ServizioInScadenza[] }) {
  return (
    <Blocco
      titolo="Servizi in scadenza"
      icona={RefreshCw}
      descrizione="Scaduti ed entro 14 giorni."
      link={{ href: "/servizi", label: "Servizi" }}
    >
      {servizi.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nessuna scadenza nei prossimi 14 giorni.</p>
      ) : (
        <ul className="-mx-2">
          {servizi.map((s) => (
            <li key={s.id}>
              <Link
                href={hrefApri("servizio", s.id ?? "")}
                scroll={false}
                className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-muted/60"
              >
                <TipoIcona nome={s.tipo_icona} className="size-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">{s.nome}</span>
                  <span className="block text-xs text-muted-foreground">
                    {formatDate(s.prossima_scadenza ?? "")}
                    {s.rinnovo_automatico && " · rinnovo automatico"}
                  </span>
                </span>
                <StatoScadenzaBadge stato={s.stato_scadenza as StatoScadenza} giorni={s.giorni_alla_scadenza ?? 0} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Blocco>
  );
}
