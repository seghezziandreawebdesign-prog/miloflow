"use client";

import { Check } from "lucide-react";
import { useState } from "react";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { useSpuntaTask } from "./dati";

const ANELLO: Record<number, string> = {
  1: "border-red-500 bg-red-50 hover:bg-red-100",
  2: "border-amber-500 bg-amber-50 hover:bg-amber-100",
  3: "border-sky-500 bg-sky-50 hover:bg-sky-100",
};

type TaskDaCompletare = { id: string; titolo: string; sottotask_aperte?: number };

/**
 * Completamento con la domanda sulle sottotask aperte: `completa(task)`
 * completa subito oppure apre il dialog; `dialog` va messo nel JSX.
 */
export function useCompletaConConferma({ onAnnulla }: { onAnnulla?: () => void } = {}) {
  const { completa, riapri } = useSpuntaTask();
  const [inAttesa, setInAttesa] = useState<TaskDaCompletare | null>(null);
  const aperte = inAttesa?.sottotask_aperte ?? 0;

  function conferma(sottotask: boolean) {
    if (!inAttesa) return;
    completa.mutate({ id: inAttesa.id, titolo: inAttesa.titolo, sottotask });
    setInAttesa(null);
  }

  const dialog = (
    <AlertDialog
      open={inAttesa !== null}
      onOpenChange={(open) => {
        if (!open && inAttesa) {
          setInAttesa(null);
          onAnnulla?.();
        }
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Completare anche le sottotask?</AlertDialogTitle>
          <AlertDialogDescription>
            «{inAttesa?.titolo}» ha {aperte === 1 ? "una sottotask aperta" : `${aperte} sottotask aperte`}.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Annulla</AlertDialogCancel>
          <Button variant="outline" onClick={() => conferma(false)}>
            Solo la task
          </Button>
          <Button onClick={() => conferma(true)}>Completa tutto</Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return {
    completa: (task: TaskDaCompletare) => {
      if ((task.sottotask_aperte ?? 0) > 0) setInAttesa(task);
      else completa.mutate({ id: task.id, titolo: task.titolo });
    },
    riapri: (id: string) => riapri.mutate({ id }),
    dialog,
  };
}

/** Spunta tonda di una task, colorata per priorità. */
export function TaskCheckbox({
  task,
  className,
}: {
  task: TaskDaCompletare & { stato: string; priorita: number | null };
  className?: string;
}) {
  const { completa, riapri, dialog } = useCompletaConConferma();
  const fatta = task.stato === "fatto";

  return (
    <>
      <button
        type="button"
        role="checkbox"
        aria-checked={fatta}
        aria-label={fatta ? `Riapri «${task.titolo}»` : `Completa «${task.titolo}»`}
        onClick={(event) => {
          event.stopPropagation();
          if (fatta) riapri(task.id);
          else completa(task);
        }}
        onPointerDown={(event) => event.stopPropagation()}
        className={cn(
          "group/check grid size-[18px] shrink-0 place-items-center rounded-full border-[1.5px] border-muted-foreground/50 transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50",
          task.priorita ? ANELLO[task.priorita] : null,
          fatta && "border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700",
          className,
        )}
      >
        <Check
          strokeWidth={3}
          className={cn("size-3", fatta ? "opacity-100" : "opacity-0 group-hover/check:opacity-40")}
        />
      </button>
      {/* Il dialog è in un portale, ma gli eventi React risalgono comunque alla
          riga della task: qui si fermano, così non si apre il pannello. */}
      <span className="contents" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
        {dialog}
      </span>
    </>
  );
}
