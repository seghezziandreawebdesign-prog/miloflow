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

/**
 * Spunta tonda di una task, colorata per priorità. Completando una task con
 * sottotask aperte chiede se completare anche quelle.
 */
export function TaskCheckbox({
  task,
  className,
}: {
  task: { id: string; titolo: string; stato: string; priorita: number | null; sottotask_aperte?: number };
  className?: string;
}) {
  const { completa, riapri } = useSpuntaTask();
  const [chiedi, setChiedi] = useState(false);
  const fatta = task.stato === "fatto";
  const aperte = task.sottotask_aperte ?? 0;

  function onClick(event: React.MouseEvent) {
    event.stopPropagation();
    if (fatta) {
      riapri.mutate({ id: task.id });
    } else if (aperte > 0) {
      setChiedi(true);
    } else {
      completa.mutate({ id: task.id, titolo: task.titolo });
    }
  }

  function conferma(sottotask: boolean) {
    setChiedi(false);
    completa.mutate({ id: task.id, titolo: task.titolo, sottotask });
  }

  return (
    <>
      <button
        type="button"
        role="checkbox"
        aria-checked={fatta}
        aria-label={fatta ? `Riapri «${task.titolo}»` : `Completa «${task.titolo}»`}
        onClick={onClick}
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

      <AlertDialog open={chiedi} onOpenChange={setChiedi}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Completare anche le sottotask?</AlertDialogTitle>
            <AlertDialogDescription>
              «{task.titolo}» ha {aperte === 1 ? "una sottotask aperta" : `${aperte} sottotask aperte`}.
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
    </>
  );
}
