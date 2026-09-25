"use client";

import { Draggable } from "@fullcalendar/react/interaction";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronDown, GripVertical } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { useApriEntita } from "@/components/drawer/use-apri-entita";
import { invalidaTask, useTaskAperte, type TaskLista } from "@/components/task/dati";
import { Checkbox } from "@/components/ui/checkbox";
import { setEsclusaDaPianificare } from "@/lib/actions/task";
import type { FiltroAmbito } from "@/lib/ambito";
import { formatGiornoRelativo, todayISO } from "@/lib/dates/format";
import { confrontaTask } from "@/lib/task";
import { cn } from "@/lib/utils";

/**
 * Task da mettere in calendario: senza data di inizio, più quelle con la data
 * ormai passata. Si trascinano sul calendario (Draggable esterno di
 * FullCalendar, tocco prolungato su mobile); il tap apre il pannello. La
 * spunta le esclude dalla lista (sezione «Nascoste» per ripescarle).
 */
export function DaPianificare({ filtroAmbito, richiudibile }: { filtroAmbito: FiltroAmbito; richiudibile?: boolean }) {
  const { data: tasks } = useTaskAperte(filtroAmbito);
  const contenitore = useRef<HTMLDivElement>(null);
  const [aperto, setAperto] = useState(false);
  const [mostraNascoste, setMostraNascoste] = useState(false);
  // Spunte appena messe o tolte: la riga si sposta subito, senza aspettare il server.
  const [appenaEscluse, setAppenaEscluse] = useState<Map<string, boolean>>(new Map());
  const oggi = todayISO();

  const aperte = (tasks ?? []).filter((t) => t.parent_id === null);
  const esclusa = (t: TaskLista) => appenaEscluse.get(t.id) ?? t.esclusa_da_pianificare;
  const daFare = aperte.filter((t) => !esclusa(t));
  const senzaData = daFare.filter((t) => !t.data_pianificata).sort(confrontaTask);
  const inRitardo = daFare.filter((t) => t.data_pianificata !== null && t.data_pianificata < oggi).sort(confrontaTask);
  const nascoste = aperte
    .filter((t) => esclusa(t) && (!t.data_pianificata || t.data_pianificata < oggi))
    .sort(confrontaTask);
  const totale = senzaData.length + inRitardo.length;
  const conTask = totale + nascoste.length > 0;

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

  if (!conTask) return null;

  const lista = (
    <div ref={contenitore} className={cn("space-y-3", richiudibile && "max-h-[50svh] overflow-y-auto")}>
      {senzaData.length > 0 && (
        <Gruppo titolo="Senza data" tasks={senzaData} oggi={oggi} onEscludi={segna} />
      )}
      {inRitardo.length > 0 && (
        <Gruppo titolo="In ritardo" tasks={inRitardo} oggi={oggi} onEscludi={segna} />
      )}
      {totale === 0 && <p className="px-1 text-xs text-muted-foreground">Tutto pianificato o nascosto.</p>}
      {nascoste.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setMostraNascoste((v) => !v)}
            aria-expanded={mostraNascoste}
            className="flex items-center gap-1 px-1 pb-1 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <ChevronDown className={cn("size-3.5 transition-transform", mostraNascoste && "rotate-180")} />
            Nascoste ({nascoste.length})
          </button>
          {mostraNascoste && <Gruppo tasks={nascoste} oggi={oggi} onEscludi={segna} nascoste />}
        </div>
      )}
    </div>
  );

  function segna(t: TaskLista, esclusa: boolean) {
    setAppenaEscluse((m) => new Map(m).set(t.id, esclusa));
  }

  if (!richiudibile) {
    return (
      <section className="mt-5 border-t pt-4">
        <h3 className="mb-1 px-1 text-[11px] font-semibold tracking-wider text-muted-foreground/80 uppercase">
          Da pianificare · {totale}
        </h3>
        <p className="mb-2 px-1 text-xs text-muted-foreground">
          Trascina sul calendario per dare una data; la spunta nasconde dalla lista.
        </p>
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
          <p className="mb-2 text-xs text-muted-foreground">
            Tieni premuto e trascina sul calendario; tocca per aprire; la spunta nasconde.
          </p>
          {lista}
        </div>
      )}
    </section>
  );
}

function Gruppo({
  titolo,
  tasks,
  oggi,
  onEscludi,
  nascoste = false,
}: {
  titolo?: string;
  tasks: TaskLista[];
  oggi: string;
  onEscludi: (t: TaskLista, esclusa: boolean) => void;
  /** Sezione delle escluse: la spunta è piena e toglierla le ripesca. */
  nascoste?: boolean;
}) {
  const apri = useApriEntita();
  const queryClient = useQueryClient();
  const [, startTransition] = useTransition();

  function toggle(t: TaskLista) {
    onEscludi(t, !nascoste);
    startTransition(async () => {
      const result = await setEsclusaDaPianificare(t.id, !nascoste);
      if (!result.ok) {
        toast.error(result.error);
        onEscludi(t, nascoste);
        return;
      }
      invalidaTask(queryClient);
    });
  }

  return (
    <div>
      {titolo && <p className="px-1 pb-1 text-xs font-medium text-muted-foreground">{titolo}</p>}
      <ul className="space-y-1">
        {tasks.map((t) => (
          <li
            key={t.id}
            className={cn(
              "flex items-center gap-1.5 rounded-lg bg-card px-1.5 py-1.5 text-sm ring-1 ring-black/8",
              nascoste && "opacity-70",
            )}
          >
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
            <Checkbox
              checked={nascoste}
              onCheckedChange={() => toggle(t)}
              aria-label={nascoste ? `Rimetti ${t.titolo} tra quelle da pianificare` : `Non pianificare ${t.titolo}`}
              title={nascoste ? "Rimetti tra quelle da pianificare" : "Non pianificare: nascondi dalla lista"}
              className="shrink-0"
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
