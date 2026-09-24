"use client";

import { ArrowLeft, Building2, ChevronDown, Columns3, List, Pencil } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { useApriEntita } from "@/components/drawer/use-apri-entita";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/dates/format";
import { confrontaTask, statoProgetto } from "@/lib/task";
import { useLocalPreference } from "@/lib/use-local-preference";
import { cn } from "@/lib/utils";

import { AggiuntaRapida } from "./aggiunta-rapida";
import { useProgetto, useTaskProgetto } from "./dati";
import { Kanban } from "./kanban";
import { ListaSkeleton, ListaTask } from "./liste";
import { Progresso } from "./progresso";

type Vista = "lista" | "kanban";

export function ProgettoPagina({ id }: { id: string }) {
  const { data: progetto, isPending } = useProgetto(id);
  const { data: tasks, isPending: taskPending } = useTaskProgetto(id);
  const [vista, setVista] = useLocalPreference<Vista>("progetto.vista", ["lista", "kanban"], "lista");
  const apri = useApriEntita();

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

  return (
    <div className="space-y-6">
      <Link href="/task?vista=progetti" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" />
        Progetti
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: progetto.colore ?? "var(--muted-foreground)" }} />
            <h1 className="truncate text-2xl font-semibold tracking-tight">{progetto.nome}</h1>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
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
        </div>
        <div className="flex items-center gap-2">
          <div role="radiogroup" aria-label="Vista" className="inline-flex rounded-lg bg-muted p-0.5">
            {(
              [
                { value: "lista", label: "Lista", icon: List },
                { value: "kanban", label: "Kanban", icon: Columns3 },
              ] as const
            ).map((v) => (
              <button
                key={v.value}
                type="button"
                role="radio"
                aria-checked={vista === v.value}
                onClick={() => setVista(v.value)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-sm text-muted-foreground",
                  vista === v.value && "bg-background font-medium text-foreground shadow-sm",
                )}
              >
                <v.icon className="size-4" />
                {v.label}
              </button>
            ))}
          </div>
          <Button variant="outline" size="icon" aria-label="Dettagli progetto" onClick={() => apri({ tipo: "progetto", id })}>
            <Pencil />
          </Button>
        </div>
      </div>

      <Progresso fatte={progetto.task_fatte ?? 0} totali={progetto.task_totali ?? 0} colore={progetto.colore} className="max-w-md" />
      {progetto.descrizione && <p className="max-w-3xl text-sm whitespace-pre-line text-muted-foreground">{progetto.descrizione}</p>}

      <AggiuntaRapida
        defaults={{ ambito: progetto.ambito ?? "lavoro", progetto_id: id }}
        placeholder="Aggiungi una task al progetto"
      />

      {taskPending ? (
        <ListaSkeleton />
      ) : vista === "kanban" ? (
        <Kanban tasks={tasks ?? []} />
      ) : (
        <div className="space-y-6">
          <ListaTask
            tasks={aperte}
            opzioni={{ senzaProgetto: true, senzaCliente: true }}
            vuoto="Nessuna task aperta: aggiungine una qui sopra."
          />
          {fatte.length > 0 && <Completate tasks={fatte} />}
        </div>
      )}
    </div>
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
        <ListaTask tasks={tasks} opzioni={{ senzaProgetto: true, senzaCliente: true }} />
      </CollapsibleContent>
    </Collapsible>
  );
}
