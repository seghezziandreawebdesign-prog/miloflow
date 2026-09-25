"use client";

import { Draggable } from "@fullcalendar/react/interaction";
import { ChevronDown, GripVertical } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { useApriEntita } from "@/components/drawer/use-apri-entita";
import { useTaskAperte, type TaskLista } from "@/components/task/dati";
import type { FiltroAmbito } from "@/lib/ambito";
import { formatGiornoRelativo, todayISO } from "@/lib/dates/format";
import { confrontaTask } from "@/lib/task";
import { cn } from "@/lib/utils";

/**
 * Task da mettere in calendario: senza data di inizio, più quelle con la data
 * ormai passata. Si trascinano sul calendario (Draggable esterno di
 * FullCalendar, tocco prolungato su mobile); il tap apre il pannello.
 */
export function DaPianificare({ filtroAmbito, richiudibile }: { filtroAmbito: FiltroAmbito; richiudibile?: boolean }) {
  const { data: tasks } = useTaskAperte(filtroAmbito);
  const contenitore = useRef<HTMLDivElement>(null);
  const [aperto, setAperto] = useState(false);
  const oggi = todayISO();

  const aperte = (tasks ?? []).filter((t) => t.parent_id === null);
  const senzaData = aperte.filter((t) => !t.data_pianificata).sort(confrontaTask);
  const inRitardo = aperte.filter((t) => t.data_pianificata !== null && t.data_pianificata < oggi).sort(confrontaTask);
  const totale = senzaData.length + inRitardo.length;
  const conTask = totale > 0;

  useEffect(() => {
    if (!contenitore.current) return;
    const draggable = new Draggable(contenitore.current, {
      itemSelector: "[data-task-id]",
      minDistance: 6,
      longPressDelay: 200,
      eventData: (el) => ({
        title: el.getAttribute("data-titolo") ?? "Task",
        // L'evento lo crea l'app aggiornando la task, non FullCalendar.
        create: false,
        duration: { minutes: Number(el.getAttribute("data-durata")) || 60 },
      }),
    });
    return () => draggable.destroy();
  }, [conTask]);

  if (totale === 0) return null;

  const lista = (
    <div ref={contenitore} className="max-h-72 space-y-3 overflow-y-auto lg:max-h-[40svh]">
      {senzaData.length > 0 && <Gruppo titolo="Senza data" tasks={senzaData} oggi={oggi} />}
      {inRitardo.length > 0 && <Gruppo titolo="In ritardo" tasks={inRitardo} oggi={oggi} />}
    </div>
  );

  if (!richiudibile) {
    return (
      <section className="mt-5 border-t pt-4">
        <h3 className="mb-2 px-1 text-[11px] font-semibold tracking-wider text-muted-foreground/80 uppercase">
          Da pianificare · {totale}
        </h3>
        <p className="mb-2 px-1 text-xs text-muted-foreground">Trascina una task sul calendario per darle una data.</p>
        {lista}
      </section>
    );
  }

  return (
    <section className="rounded-xl bg-card px-3 py-2 ring-1 ring-black/8">
      <button
        type="button"
        onClick={() => setAperto((v) => !v)}
        aria-expanded={aperto}
        className="flex w-full items-center gap-2 text-sm font-medium"
      >
        Da pianificare
        <span className="text-xs text-muted-foreground tabular-nums">{totale}</span>
        <ChevronDown className={cn("ml-auto size-4 text-muted-foreground transition-transform", aperto && "rotate-180")} />
      </button>
      {aperto && (
        <div className="pt-2 pb-1">
          <p className="mb-2 text-xs text-muted-foreground">Tieni premuto e trascina sul calendario; tocca per aprire.</p>
          {lista}
        </div>
      )}
    </section>
  );
}

function Gruppo({ titolo, tasks, oggi }: { titolo: string; tasks: TaskLista[]; oggi: string }) {
  const apri = useApriEntita();
  return (
    <div>
      <p className="px-1 pb-1 text-xs font-medium text-muted-foreground">{titolo}</p>
      <ul className="space-y-1">
        {tasks.map((t) => (
          <li key={t.id} className="flex items-center gap-1.5 rounded-lg bg-card px-1.5 py-1.5 text-sm ring-1 ring-black/8">
            {/* La maniglia è l'elemento trascinabile: il resto della riga scorre e si apre col tap. */}
            <span
              data-task-id={t.id}
              data-titolo={t.titolo}
              data-durata={t.durata_min ?? ""}
              aria-label={`Trascina ${t.titolo} sul calendario`}
              className="cursor-grab touch-none rounded p-0.5 text-muted-foreground/60 active:cursor-grabbing"
            >
              <GripVertical className="size-3.5" />
            </span>
            <button
              type="button"
              onClick={() => apri({ tipo: "task", id: t.id })}
              className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
            >
              <span className="min-w-0 flex-1 truncate">{t.titolo}</span>
              {t.data_pianificata && t.data_pianificata < oggi && (
                <span className="shrink-0 text-xs text-red-600">{formatGiornoRelativo(t.data_pianificata, oggi).toLowerCase()}</span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
