"use client";

import { Plus } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import type { TaskLista } from "./dati";
import { TaskRow, type OpzioniRiga } from "./task-row";

/** Elenco semplice di task. */
export function ListaTask({
  tasks,
  opzioni,
  vuoto,
  className,
}: {
  tasks: TaskLista[];
  opzioni?: OpzioniRiga;
  vuoto?: React.ReactNode;
  className?: string;
}) {
  if (tasks.length === 0) {
    return vuoto ? <div className="px-2 py-3 text-sm text-muted-foreground">{vuoto}</div> : null;
  }
  return (
    <div className={cn("divide-y divide-black/5", className)}>
      {tasks.map((t) => (
        <TaskRow key={t.id} task={t} opzioni={opzioni} />
      ))}
    </div>
  );
}

/** Gruppo con titolo e conteggio (es. un giorno, "In ritardo"). */
export function GruppoTask({
  titolo,
  conteggio,
  tono,
  azione,
  children,
}: {
  titolo: React.ReactNode;
  conteggio?: number;
  tono?: "ritardo";
  azione?: { label: string; onClick: () => void };
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-1.5">
      <div className="flex items-center gap-2 px-1">
        <h2 className={cn("text-[13px] font-semibold", tono === "ritardo" ? "text-red-600" : "text-muted-foreground")}>{titolo}</h2>
        {conteggio !== undefined && conteggio > 0 && (
          <span className="text-xs text-muted-foreground tabular-nums">{conteggio}</span>
        )}
        {azione && (
          <button
            type="button"
            onClick={azione.onClick}
            className="ml-auto inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <Plus className="size-3" />
            {azione.label}
          </button>
        )}
      </div>
      <Superficie>{children}</Superficie>
    </section>
  );
}

/** Riquadro bianco che contiene una lista (stile "inset grouped"). */
export function Superficie({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("overflow-hidden rounded-2xl bg-card px-1 py-1 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-black/8", className)}>
      {children}
    </div>
  );
}

export function ListaSkeleton({ righe = 4 }: { righe?: number }) {
  return (
    <div className="space-y-3 py-2">
      {Array.from({ length: righe }, (_, i) => (
        <div key={i} className="flex items-center gap-3 px-2">
          <Skeleton className="size-[18px] rounded-full" />
          <Skeleton className="h-4 flex-1" />
        </div>
      ))}
    </div>
  );
}
