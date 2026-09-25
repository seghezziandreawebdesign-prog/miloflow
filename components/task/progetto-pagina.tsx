"use client";

import { ArrowLeft, Building2, ChevronDown, Pencil, Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { useApriEntita } from "@/components/drawer/use-apri-entita";
import { PulsanteSeleziona, SelezioneProvider } from "@/components/selezione";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/dates/format";
import { confrontaTask, statoProgetto } from "@/lib/task";
import { cn } from "@/lib/utils";

import { AggiuntaRapida } from "./aggiunta-rapida";
import { AzioniMultipleTask } from "./azioni-multiple";
import { useProgetto, useSottoprogetti, useTaskProgetto } from "./dati";
import { IntestazioneVista } from "./intestazione-vista";
import { Kanban } from "./kanban";
import { ListaSkeleton, ListaTask, Superficie } from "./liste";
import { useNuovoProgetto } from "./nuova-task";
import { ProgettoCard } from "./progetti-lista";
import { Progresso } from "./progresso";
import { PulsanteNuovaTask } from "./pulsante-nuova-task";
import { SwitchListaBoard, useModoTutte } from "./tutte-le-task";

export function ProgettoPagina({ id }: { id: string }) {
  const { data: progetto, isPending } = useProgetto(id);
  const { data: tasks, isPending: taskPending } = useTaskProgetto(id);
  const { data: sottoprogetti } = useSottoprogetti(id);
  const [modo, setModo] = useModoTutte();
  const apri = useApriEntita();
  const nuovoProgetto = useNuovoProgetto();

  if (isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-4 w-1/3" />
        <ListaSkeleton />
      </div>
    );
  }
  if (!progetto) {
    return <p className="py-12 text-center text-sm text-muted-foreground">Progetto non trovato o non accessibile.</p>;
  }

  const stato = statoProgetto(progetto.stato ?? "attivo");
  const aperte = (tasks ?? []).filter((t) => t.stato !== "fatto").sort(confrontaTask);
  const fatte = (tasks ?? [])
    .filter((t) => t.stato === "fatto")
    .sort((a, b) => (b.completata_il ?? "").localeCompare(a.completata_il ?? ""));
  const figli = (sottoprogetti ?? []).filter((p) => p.stato !== "archiviato");

  return (
    <SelezioneProvider key={modo} className="space-y-5">
      <IntestazioneVista
        prima={
          progetto.parent_id ? (
            <LinkPadre id={progetto.parent_id} />
          ) : (
            <Link
              href="/task?vista=progetti"
              className="mb-1 inline-flex items-center gap-1 text-sm text-primary hover:underline lg:hidden"
            >
              <ArrowLeft className="size-4" />
              Progetti
            </Link>
          )
        }
        titolo={
          <span className="flex min-w-0 items-center gap-2">
            <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: progetto.colore ?? "var(--muted-foreground)" }} />
            <span className="truncate">{progetto.nome}</span>
          </span>
        }
        descrizione={
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className={cn("rounded-full px-2 py-0.5 text-xs ring-1 ring-inset", stato.className)}>{stato.label}</span>
            {progetto.ambito === "personale" && (
              <span className="rounded-full bg-ambito-personale-soft px-2 py-0.5 text-xs text-ambito-personale">Personale</span>
            )}
            {progetto.cliente_id && progetto.cliente_nome && (
              <Link href={`/clienti/${progetto.cliente_id}`} className="inline-flex items-center gap-1 hover:text-foreground">
                <Building2 className="size-3.5" />
                {progetto.cliente_nome}
              </Link>
            )}
            {progetto.scadenza && <span>Scadenza {formatDate(progetto.scadenza)}</span>}
          </div>
        }
        azioni={
          <>
            {modo === "lista" && <PulsanteSeleziona />}
            <SwitchListaBoard value={modo} onChange={setModo} />
            <Button variant="outline" size="icon" aria-label="Dettagli progetto" onClick={() => apri({ tipo: "progetto", id })}>
              <Pencil />
            </Button>
            <PulsanteNuovaTask
              label="Aggiungi task"
              valori={{ ambito: progetto.ambito ?? "lavoro", progetto_id: id, cliente_id: progetto.cliente_id ?? "" }}
            />
          </>
        }
      />

      <Progresso fatte={progetto.task_fatte ?? 0} totali={progetto.task_totali ?? 0} colore={progetto.colore} className="max-w-md" />
      {progetto.descrizione && <p className="max-w-3xl text-sm whitespace-pre-line text-muted-foreground">{progetto.descrizione}</p>}

      {!progetto.parent_id && (
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-muted-foreground">Sottoprogetti</h2>
            <Button variant="ghost" size="sm" className="text-primary" onClick={() => nuovoProgetto({ parent_id: id })}>
              <Plus />
              Sottoprogetto
            </Button>
          </div>
          {figli.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {figli.map((p) => (
                <ProgettoCard key={p.id} progetto={p} />
              ))}
            </div>
          )}
        </section>
      )}

      <AggiuntaRapida
        defaults={{ ambito: progetto.ambito ?? "lavoro", progetto_id: id }}
        placeholder="Aggiungi una task al progetto"
      />

      {taskPending ? (
        <ListaSkeleton />
      ) : modo === "board" ? (
        <Kanban tasks={tasks ?? []} />
      ) : (
        <div className="space-y-6">
          <Superficie>
            <ListaTask
              tasks={aperte}
              opzioni={{ senzaProgetto: true, senzaCliente: true }}
              vuoto="Nessuna task aperta: aggiungine una qui sopra."
            />
          </Superficie>
          {fatte.length > 0 && <Completate tasks={fatte} />}
        </div>
      )}
      {modo === "lista" && <AzioniMultipleTask />}
    </SelezioneProvider>
  );
}

/** Link al progetto padre di un sottoprogetto. */
function LinkPadre({ id }: { id: string }) {
  const { data: padre } = useProgetto(id);
  return (
    <Link href={`/task/progetti/${id}`} className="mb-1 inline-flex items-center gap-1 text-sm text-primary hover:underline">
      <ArrowLeft className="size-4" />
      {padre?.nome ?? "Progetto"}
    </Link>
  );
}

function Completate({ tasks }: { tasks: Parameters<typeof ListaTask>[0]["tasks"] }) {
  const [aperto, setAperto] = useState(false);
  return (
    <Collapsible open={aperto} onOpenChange={setAperto}>
      <CollapsibleTrigger render={<Button variant="ghost" size="sm" className="-ml-2 text-muted-foreground" />}>
        <ChevronDown className={cn("transition-transform", aperto && "rotate-180")} />
        Completate ({tasks.length})
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-2">
        <Superficie>
          <ListaTask tasks={tasks} opzioni={{ senzaProgetto: true, senzaCliente: true }} />
        </Superficie>
      </CollapsibleContent>
    </Collapsible>
  );
}
