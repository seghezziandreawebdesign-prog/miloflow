"use client";

import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useState } from "react";

import { ordineTra, STATI_TASK, type StatoTask } from "@/lib/task";
import { cn } from "@/lib/utils";

import { useRiordinaTask, type TaskLista } from "./dati";
import { InAttesaDialog } from "./in-attesa-dialog";
import { useCompletaConConferma } from "./task-checkbox";
import { TaskRow, type OpzioniRiga } from "./task-row";

type Colonne = Record<StatoTask, string[]>;

const STATI = STATI_TASK.map((s) => s.value);

function costruisci(tasks: TaskLista[]): Colonne {
  const colonne: Colonne = { da_fare: [], in_corso: [], in_attesa: [], fatto: [] };
  const ordinate = [...tasks].sort((a, b) => a.ordine - b.ordine || a.created_at.localeCompare(b.created_at));
  for (const t of ordinate) colonne[t.stato].push(t.id);
  return colonne;
}

/**
 * Kanban per stato con drag & drop. Spostare in "In attesa" chiede di cosa;
 * in "Fatto" completa la task (con la domanda sulle sottotask aperte).
 */
export function Kanban({
  tasks,
  opzioniRiga = { senzaProgetto: true, senzaCliente: true },
}: {
  tasks: TaskLista[];
  opzioniRiga?: OpzioniRiga;
}) {
  const [colonne, setColonne] = useState<Colonne>(() => costruisci(tasks));
  const [origine, setOrigine] = useState(tasks);
  const [attiva, setAttiva] = useState<string | null>(null);
  const [attesa, setAttesa] = useState<{ id: string; ordine: number } | null>(null);
  const riordina = useRiordinaTask();
  const ripristina = () => setColonne(costruisci(tasks));
  const { completa, dialog } = useCompletaConConferma({ onAnnulla: ripristina });

  // Quando i dati cambiano da fuori (salvataggi, refetch) e non si sta
  // trascinando, le colonne ripartono dal database.
  if (tasks !== origine && attiva === null) {
    setOrigine(tasks);
    setColonne(costruisci(tasks));
  }

  const perId = new Map(tasks.map((t) => [t.id, t]));
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function colonnaDi(id: string, stato: Colonne = colonne): StatoTask | null {
    if ((STATI as string[]).includes(id)) return id as StatoTask;
    return STATI.find((s) => stato[s].includes(id)) ?? null;
  }

  function onDragStart(event: DragStartEvent) {
    setAttiva(String(event.active.id));
  }

  function onDragOver({ active, over }: DragOverEvent) {
    if (!over) return;
    const da = colonnaDi(String(active.id));
    const a = colonnaDi(String(over.id));
    if (!da || !a || da === a) return;
    setColonne((c) => {
      const destinazione = c[a];
      const indice = destinazione.indexOf(String(over.id));
      const posizione = indice >= 0 ? indice : destinazione.length;
      return {
        ...c,
        [da]: c[da].filter((id) => id !== active.id),
        [a]: [...destinazione.slice(0, posizione), String(active.id), ...destinazione.slice(posizione)],
      };
    });
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    setAttiva(null);
    const id = String(active.id);
    const task = perId.get(id);
    const colonna = colonnaDi(id);
    if (!task || !over || !colonna) {
      ripristina();
      return;
    }

    let lista = colonne[colonna];
    const overIndex = lista.indexOf(String(over.id));
    const activeIndex = lista.indexOf(id);
    if (overIndex >= 0 && overIndex !== activeIndex) {
      lista = arrayMove(lista, activeIndex, overIndex);
      setColonne({ ...colonne, [colonna]: lista });
    }
    const indice = lista.indexOf(id);
    const prima = indice > 0 ? (perId.get(lista[indice - 1])?.ordine ?? null) : null;
    const dopo = indice < lista.length - 1 ? (perId.get(lista[indice + 1])?.ordine ?? null) : null;
    const ordine = ordineTra(prima, dopo);

    if (colonna === task.stato) {
      if (indice === costruisci(tasks)[colonna].indexOf(id)) return;
      if (colonna !== "fatto") riordina.mutate({ id, stato: colonna, ordine });
      return;
    }
    if (colonna === "fatto") {
      completa(task);
      return;
    }
    if (colonna === "in_attesa") {
      setAttesa({ id, ordine });
      return;
    }
    riordina.mutate({ id, stato: colonna, ordine });
  }

  const taskAttiva = attiva ? perId.get(attiva) : undefined;

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        onDragCancel={() => {
          setAttiva(null);
          ripristina();
        }}
      >
        <div className="-mx-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
          <div className="grid min-w-[56rem] grid-cols-4 gap-3">
            {STATI_TASK.map((s) => (
              <Colonna
                key={s.value}
                stato={s.value}
                titolo={s.label}
                ids={colonne[s.value]}
                perId={perId}
                opzioniRiga={opzioniRiga}
              />
            ))}
          </div>
        </div>
        <DragOverlay dropAnimation={null}>
          {taskAttiva && (
            <div className="rounded-lg bg-background shadow-lg ring-1 ring-foreground/10">
              <TaskRow task={taskAttiva} opzioni={opzioniRiga} />
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {dialog}
      <InAttesaDialog
        open={attesa !== null}
        onOpenChange={(open) => {
          if (!open) {
            setAttesa(null);
            // Chiuso senza conferma: la task torna dov'era.
            ripristina();
          }
        }}
        valore={attesa ? (perId.get(attesa.id)?.in_attesa_di ?? "") : ""}
        onConferma={(inAttesaDi) => {
          if (attesa) riordina.mutate({ id: attesa.id, stato: "in_attesa", ordine: attesa.ordine, in_attesa_di: inAttesaDi });
          setAttesa(null);
        }}
      />
    </>
  );
}

function Colonna({
  stato,
  titolo,
  ids,
  perId,
  opzioniRiga,
}: {
  stato: StatoTask;
  titolo: string;
  ids: string[];
  perId: Map<string, TaskLista>;
  opzioniRiga: OpzioniRiga;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stato });
  return (
    <section
      ref={setNodeRef}
      aria-label={titolo}
      className={cn("flex min-h-40 flex-col gap-1 rounded-xl bg-muted/50 p-2", isOver && "ring-2 ring-primary")}
    >
      <h3 className="flex items-baseline gap-2 px-1 pb-1 text-sm font-semibold">
        {titolo}
        <span className="text-xs font-normal text-muted-foreground tabular-nums">{ids.length}</span>
      </h3>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        {ids.map((id) => {
          const task = perId.get(id);
          return task ? <Scheda key={id} task={task} opzioniRiga={opzioniRiga} /> : null;
        })}
      </SortableContext>
    </section>
  );
}

function Scheda({ task, opzioniRiga }: { task: TaskLista; opzioniRiga: OpzioniRiga }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
      className={cn(
        "cursor-grab touch-manipulation rounded-lg bg-background ring-1 ring-foreground/10 active:cursor-grabbing",
        isDragging && "opacity-40",
      )}
    >
      <TaskRow task={task} opzioni={opzioniRiga} />
    </div>
  );
}
