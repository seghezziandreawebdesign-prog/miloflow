"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useQueryClient } from "@tanstack/react-query";
import { CalendarRange, ChevronDown, FolderKanban, GripVertical, Hourglass, Inbox, LayoutGrid, ListChecks, Plus, Sun, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { riordinaProgetti } from "@/lib/actions/task";
import type { FiltroAmbito } from "@/lib/ambito";
import { todayISO } from "@/lib/dates/format";
import { alberoProgetti, avanzamento, isInbox, taskDiOggi } from "@/lib/task";
import { cn } from "@/lib/utils";

import { chiaviProgetti, useProgetti, useTaskAperte, type ProgettoLista } from "./dati";
import { useNuovoProgetto } from "./nuova-task";
import { VISTE, type Vista } from "./viste";

const ICONE: Record<Vista, LucideIcon> = {
  inbox: Inbox,
  oggi: Sun,
  settimana: CalendarRange,
  attesa: Hourglass,
  pianifica: LayoutGrid,
  tutte: ListChecks,
  progetti: FolderKanban,
};

const VISTE_COLONNA: Vista[] = ["inbox", "oggi", "settimana", "attesa", "pianifica"];

function useSelezione() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const progettoId = pathname.match(/^\/task\/progetti\/([^/]+)/)?.[1] ?? null;
  const param = searchParams.get("vista");
  const vista: Vista | null = progettoId ? null : VISTE.some((v) => v.value === param) ? (param as Vista) : "oggi";
  return { progettoId, vista };
}

/** Colonna sinistra su desktop; su mobile un selettore che apre un foglio dal basso. */
export function TaskSidebar({ filtroAmbito }: { filtroAmbito: FiltroAmbito }) {
  const { progettoId, vista } = useSelezione();
  const { data: progetti } = useProgetti(filtroAmbito);
  const [aperto, setAperto] = useState(false);

  const progettoCorrente = progetti?.find((p) => p.id === progettoId);
  const etichetta = progettoId
    ? (progettoCorrente?.nome ?? "Progetto")
    : (VISTE.find((v) => v.value === vista)?.label ?? "Task");

  return (
    <>
      <aside className="sticky top-[4.5rem] hidden max-h-[calc(100svh-5.5rem)] overflow-y-auto pr-1 lg:block">
        <Contenuto filtroAmbito={filtroAmbito} progettoId={progettoId} vista={vista} />
      </aside>

      <div className="lg:hidden">
        <button
          type="button"
          onClick={() => setAperto(true)}
          aria-haspopup="dialog"
          className="inline-flex max-w-full items-center gap-2 rounded-lg bg-card py-1.5 pr-2.5 pl-3 text-[15px] font-semibold ring-1 ring-black/8 active:bg-muted"
        >
          {progettoCorrente?.colore && <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: progettoCorrente.colore }} />}
          <span className="truncate">{etichetta}</span>
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
        </button>
        <Sheet open={aperto} onOpenChange={setAperto}>
          <SheetContent
            side="bottom"
            showCloseButton={false}
            className="max-h-[85svh] overflow-y-auto rounded-t-2xl p-3 pb-[max(1rem,env(safe-area-inset-bottom))]"
          >
            <SheetTitle className="sr-only">Viste e progetti</SheetTitle>
            <Contenuto filtroAmbito={filtroAmbito} progettoId={progettoId} vista={vista} onNavigate={() => setAperto(false)} large />
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}

function Contenuto({
  filtroAmbito,
  progettoId,
  vista,
  onNavigate,
  large,
}: {
  filtroAmbito: FiltroAmbito;
  progettoId: string | null;
  vista: Vista | null;
  onNavigate?: () => void;
  large?: boolean;
}) {
  const { data: tasks } = useTaskAperte(filtroAmbito);
  const { data: progetti } = useProgetti(filtroAmbito);
  const nuovoProgetto = useNuovoProgetto();
  const oggi = todayISO();
  const tutte = tasks ?? [];
  const perOggi = taskDiOggi(tutte, oggi);
  const conteggi: Partial<Record<Vista, number>> = {
    inbox: tutte.filter(isInbox).length,
    oggi: perOggi.inRitardo.length + perOggi.perOggi.length,
    attesa: tutte.filter((t) => t.stato === "in_attesa").length,
  };
  const correnti = (progetti ?? []).filter((p) => p.stato === "attivo" || p.stato === "in_pausa");

  return (
    <nav className="flex flex-col gap-0.5" aria-label="Viste e progetti">
      <Gruppo>Viste</Gruppo>
      {VISTE_COLONNA.map((v) => {
        const Icona = ICONE[v];
        return (
          <Voce key={v} href={`/task?vista=${v}`} attiva={vista === v} onNavigate={onNavigate} large={large}>
            <Icona className={cn("size-4 shrink-0", vista === v ? "text-primary" : "text-muted-foreground")} />
            <span className="truncate">{VISTE.find((x) => x.value === v)?.label}</span>
            {(conteggi[v] ?? 0) > 0 && <span className="ml-auto text-xs text-muted-foreground tabular-nums">{conteggi[v]}</span>}
          </Voce>
        );
      })}

      <Gruppo className="mt-3">Progetti</Gruppo>
      <Voce href="/task?vista=tutte" attiva={vista === "tutte"} onNavigate={onNavigate} large={large}>
        <ListChecks className={cn("size-4 shrink-0", vista === "tutte" ? "text-primary" : "text-muted-foreground")} />
        Tutte le task
      </Voce>
      <ColonnaProgetti progetti={correnti} progettoId={progettoId} onNavigate={onNavigate} large={large} />
      <Voce href="/task?vista=progetti" attiva={vista === "progetti"} onNavigate={onNavigate} large={large}>
        <FolderKanban className={cn("size-4 shrink-0", vista === "progetti" ? "text-primary" : "text-muted-foreground")} />
        Tutti i progetti
      </Voce>
      <button
        type="button"
        onClick={() => {
          onNavigate?.();
          nuovoProgetto();
        }}
        className={cn(
          "flex items-center gap-2.5 rounded-lg px-2.5 text-left text-primary hover:bg-primary-soft",
          large ? "py-2.5 text-[15px]" : "py-1.5 text-sm",
        )}
      >
        <Plus className="size-4 shrink-0" />
        Nuovo progetto
      </button>
    </nav>
  );
}

/**
 * Progetti attivi e in pausa, con i sottoprogetti sotto il padre. Il
 * trascinamento (dalla maniglia) riordina un livello per volta; l'ordine
 * locale si riallinea quando arrivano dati nuovi dal server.
 */
function ColonnaProgetti({
  progetti,
  progettoId,
  onNavigate,
  large,
}: {
  progetti: ProgettoLista[];
  progettoId: string | null;
  onNavigate?: () => void;
  large?: boolean;
}) {
  const [stato, setStato] = useState({ progetti, albero: alberoProgetti(progetti) });
  if (stato.progetti !== progetti) setStato({ progetti, albero: alberoProgetti(progetti) });
  const albero = stato.albero;
  const queryClient = useQueryClient();
  const router = useRouter();
  const [, startTransition] = useTransition();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function salvaOrdine(ids: string[]) {
    startTransition(async () => {
      const result = await riordinaProgetti(ids);
      if (!result.ok) toast.error(result.error);
      await queryClient.invalidateQueries({ queryKey: chiaviProgetti.tutti });
      router.refresh();
    });
  }

  function onDragEndRadici(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const da = albero.findIndex((r) => r.padre.id === active.id);
    const a = albero.findIndex((r) => r.padre.id === over.id);
    const nuovo = arrayMove(albero, da, a);
    setStato((s) => ({ ...s, albero: nuovo }));
    salvaOrdine(nuovo.map((r) => r.padre.id));
  }

  function onDragEndFigli(padreId: string, e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const ramo = albero.find((r) => r.padre.id === padreId);
    if (!ramo) return;
    const da = ramo.figli.findIndex((f) => f.id === active.id);
    const a = ramo.figli.findIndex((f) => f.id === over.id);
    const figli = arrayMove(ramo.figli, da, a);
    setStato((s) => ({ ...s, albero: s.albero.map((r) => (r.padre.id === padreId ? { ...r, figli } : r)) }));
    salvaOrdine(figli.map((f) => f.id));
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEndRadici}>
      <SortableContext items={albero.map((r) => r.padre.id)} strategy={verticalListSortingStrategy}>
        {albero.map((ramo) => (
          <RamoProgetti key={ramo.padre.id} ramo={ramo} progettoId={progettoId} onNavigate={onNavigate} large={large} sensors={sensors} onDragEndFigli={(e) => onDragEndFigli(ramo.padre.id, e)} />
        ))}
      </SortableContext>
    </DndContext>
  );
}

function RamoProgetti({
  ramo,
  progettoId,
  onNavigate,
  large,
  sensors,
  onDragEndFigli,
}: {
  ramo: { padre: ProgettoLista; figli: ProgettoLista[] };
  progettoId: string | null;
  onNavigate?: () => void;
  large?: boolean;
  sensors: ReturnType<typeof useSensors>;
  onDragEndFigli: (e: DragEndEvent) => void;
}) {
  return (
    <VoceProgetto progetto={ramo.padre} attiva={ramo.padre.id === progettoId} onNavigate={onNavigate} large={large}>
      {ramo.figli.length > 0 && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEndFigli}>
          <SortableContext items={ramo.figli.map((f) => f.id)} strategy={verticalListSortingStrategy}>
            <div className="flex flex-col gap-0.5 pl-4">
              {ramo.figli.map((f) => (
                <VoceProgetto key={f.id} progetto={f} attiva={f.id === progettoId} onNavigate={onNavigate} large={large} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </VoceProgetto>
  );
}

function VoceProgetto({
  progetto: p,
  attiva,
  onNavigate,
  large,
  children,
}: {
  progetto: ProgettoLista;
  attiva: boolean;
  onNavigate?: () => void;
  large?: boolean;
  children?: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: p.id });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={cn(isDragging && "z-10 opacity-80")}>
      <div className="group relative">
        <Voce href={`/task/progetti/${p.id}`} attiva={attiva} onNavigate={onNavigate} large={large}>
          <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: p.colore ?? "var(--muted-foreground)" }} />
          <span className={cn("truncate", p.stato === "in_pausa" && "text-muted-foreground")}>{p.nome}</span>
          <span
            className={cn("ml-auto h-1 w-8 shrink-0 overflow-hidden rounded-full bg-black/8", large ? "mr-7" : "group-hover:opacity-0")}
            title={`${p.task_fatte ?? 0} task fatte su ${p.task_totali ?? 0}`}
          >
            <span
              className="block h-full rounded-full"
              style={{ width: `${avanzamento(p.task_fatte ?? 0, p.task_totali ?? 0)}%`, backgroundColor: p.colore ?? "var(--primary)" }}
            />
          </span>
        </Voce>
        <button
          type="button"
          aria-label={`Trascina per riordinare ${p.nome}`}
          className={cn(
            "absolute top-1/2 right-1 -translate-y-1/2 cursor-grab touch-none rounded p-1 text-muted-foreground/70 active:cursor-grabbing",
            large ? "" : "opacity-0 focus-visible:opacity-100 group-hover:opacity-100",
          )}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-4" />
        </button>
      </div>
      {children}
    </div>
  );
}

function Gruppo({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={cn("px-2.5 pb-1 text-[11px] font-semibold tracking-wider text-muted-foreground/80 uppercase", className)}>{children}</p>
  );
}

function Voce({
  href,
  attiva,
  onNavigate,
  large,
  children,
}: {
  href: string;
  attiva: boolean;
  onNavigate?: () => void;
  large?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={attiva ? "page" : undefined}
      className={cn(
        "flex items-center gap-2.5 rounded-lg px-2.5 transition-colors",
        large ? "py-2.5 text-[15px]" : "py-1.5 text-sm",
        attiva ? "bg-primary-soft font-medium text-primary" : "text-foreground hover:bg-black/4",
      )}
    >
      {children}
    </Link>
  );
}
