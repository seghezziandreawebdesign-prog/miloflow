"use client";

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { ChevronLeft, ChevronRight, GripVertical } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { capitalize, formatDate, formatLongDate, todayISO } from "@/lib/dates/format";
import { addDays, startOfWeek } from "@/lib/dates/giorni";
import { confrontaTask } from "@/lib/task";
import { cn } from "@/lib/utils";

import { useAggiornaTask, type TaskLista } from "./dati";
import { TaskRow } from "./task-row";

const DA_PIANIFICARE = "da-pianificare";

/**
 * A sinistra le task senza data pianificata (e quelle rimaste indietro), a
 * destra i giorni della settimana: trascinando una task su un giorno se ne
 * imposta la data pianificata; riportandola a sinistra la si toglie.
 */
export function PianificaSettimana({ tasks }: { tasks: TaskLista[] }) {
  const oggi = todayISO();
  const [inizio, setInizio] = useState(() => startOfWeek(oggi));
  const [trascinata, setTrascinata] = useState<TaskLista | null>(null);
  const aggiorna = useAggiornaTask();
  const giorni = Array.from({ length: 7 }, (_, i) => addDays(inizio, i));
  const fine = giorni[6];

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    useSensor(KeyboardSensor),
  );

  const aperte = tasks.filter((t) => t.stato !== "fatto");
  const senzaData = aperte.filter((t) => !t.data_pianificata && t.parent_id === null).sort(confrontaTask);
  const inRitardo = aperte
    .filter((t) => t.data_pianificata && t.data_pianificata < oggi && t.data_pianificata < inizio)
    .sort(confrontaTask);

  function onDragStart(event: DragStartEvent) {
    setTrascinata(tasks.find((t) => t.id === event.active.id) ?? null);
  }

  function onDragEnd(event: DragEndEvent) {
    setTrascinata(null);
    const task = tasks.find((t) => t.id === event.active.id);
    if (!task || !event.over) return;
    const destinazione = String(event.over.id);
    const data = destinazione === DA_PIANIFICARE ? "" : destinazione;
    if ((task.data_pianificata ?? "") === data) return;
    aggiorna.mutate({ id: task.id, patch: { data_pianificata: data }, cache: { data_pianificata: data || null } });
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setTrascinata(null)}
      accessibility={{
        screenReaderInstructions: {
          draggable:
            "Premi spazio per prendere la task, usa le frecce per spostarla su un giorno e premi di nuovo spazio per lasciarla.",
        },
      }}
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div className="space-y-4">
          <ZonaRilascio
            id={DA_PIANIFICARE}
            titolo="Da pianificare"
            descrizione="Senza data pianificata. Trascina qui una task per togliere la data."
            conteggio={senzaData.length}
          >
            {senzaData.length === 0 ? (
              <p className="px-2 py-3 text-sm text-muted-foreground">Tutto pianificato.</p>
            ) : (
              senzaData.map((t) => <TaskTrascinabile key={t.id} task={t} />)
            )}
          </ZonaRilascio>
          {inRitardo.length > 0 && (
            <section className="space-y-1 rounded-xl bg-red-50/60 p-2 ring-1 ring-red-200">
              <h3 className="px-2 pt-1 text-sm font-semibold text-red-700">
                In ritardo <span className="font-normal tabular-nums">{inRitardo.length}</span>
              </h3>
              {inRitardo.map((t) => (
                <TaskTrascinabile key={t.id} task={t} />
              ))}
            </section>
          )}
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <Button variant="outline" size="icon-sm" aria-label="Settimana precedente" onClick={() => setInizio(addDays(inizio, -7))}>
              <ChevronLeft />
            </Button>
            <div className="text-center text-sm">
              <span className="font-medium">
                {formatDate(inizio)} – {formatDate(fine)}
              </span>
              {inizio !== startOfWeek(oggi) && (
                <button
                  type="button"
                  className="ml-2 text-xs text-primary hover:underline"
                  onClick={() => setInizio(startOfWeek(oggi))}
                >
                  Questa settimana
                </button>
              )}
            </div>
            <Button variant="outline" size="icon-sm" aria-label="Settimana successiva" onClick={() => setInizio(addDays(inizio, 7))}>
              <ChevronRight />
            </Button>
          </div>

          {giorni.map((giorno) => {
            const delGiorno = aperte.filter((t) => t.data_pianificata === giorno).sort(confrontaTask);
            return (
              <ZonaRilascio
                key={giorno}
                id={giorno}
                titolo={capitalize(formatLongDate(giorno))}
                evidenza={giorno === oggi ? "oggi" : giorno < oggi ? "passato" : undefined}
                conteggio={delGiorno.length}
              >
                {delGiorno.map((t) => (
                  <TaskTrascinabile key={t.id} task={t} senzaData />
                ))}
              </ZonaRilascio>
            );
          })}
        </div>
      </div>

      <DragOverlay dropAnimation={null}>
        {trascinata && (
          <div className="rounded-lg bg-background shadow-lg ring-1 ring-foreground/10">
            <TaskRow task={trascinata} opzioni={{ senzaData: true }} />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}

function ZonaRilascio({
  id,
  titolo,
  descrizione,
  conteggio,
  evidenza,
  children,
}: {
  id: string;
  titolo: string;
  descrizione?: string;
  conteggio: number;
  evidenza?: "oggi" | "passato";
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <section
      ref={setNodeRef}
      aria-label={titolo}
      className={cn(
        "min-h-14 space-y-1 rounded-xl p-2 ring-1 ring-foreground/10 transition-colors",
        evidenza === "oggi" && "ring-primary/40",
        evidenza === "passato" && "opacity-70",
        isOver && "bg-primary/5 ring-2 ring-primary",
      )}
    >
      <div className="flex items-baseline gap-2 px-2 pt-1">
        <h3 className={cn("text-sm font-semibold", evidenza === "oggi" && "text-primary")}>{titolo}</h3>
        {conteggio > 0 && <span className="text-xs text-muted-foreground tabular-nums">{conteggio}</span>}
      </div>
      {descrizione && <p className="px-2 text-xs text-muted-foreground">{descrizione}</p>}
      {children}
    </section>
  );
}

function TaskTrascinabile({ task, senzaData }: { task: TaskLista; senzaData?: boolean }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id });
  return (
    <div ref={setNodeRef} className={cn("touch-manipulation", isDragging && "opacity-40")}>
      <TaskRow task={task} opzioni={{ senzaData }} className="pr-1">
        <button
          type="button"
          {...listeners}
          {...attributes}
          aria-label={`Sposta «${task.titolo}»`}
          onClick={(e) => e.stopPropagation()}
          className="cursor-grab touch-none rounded p-0.5 text-muted-foreground opacity-60 hover:bg-muted hover:opacity-100 active:cursor-grabbing"
        >
          <GripVertical className="size-4" />
        </button>
      </TaskRow>
    </div>
  );
}
