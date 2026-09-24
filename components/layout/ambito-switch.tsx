"use client";

import { useOptimistic, useTransition } from "react";

import { setFiltroAmbito } from "@/lib/actions/ambito";
import { ETICHETTE_AMBITO, FILTRI_AMBITO, type FiltroAmbito } from "@/lib/ambito";
import { cn } from "@/lib/utils";

const PALLINO: Record<FiltroAmbito, string | null> = {
  tutto: null,
  lavoro: "bg-ambito-lavoro",
  personale: "bg-ambito-personale",
};

export function AmbitoSwitch({ value }: { value: FiltroAmbito }) {
  const [optimistic, setOptimistic] = useOptimistic(value);
  const [, startTransition] = useTransition();

  function select(next: FiltroAmbito) {
    if (next === optimistic) return;
    startTransition(async () => {
      setOptimistic(next);
      await setFiltroAmbito(next);
    });
  }

  return (
    <div role="radiogroup" aria-label="Ambito" className="inline-flex rounded-lg bg-muted p-0.5">
      {FILTRI_AMBITO.map((filtro) => {
        const active = filtro === optimistic;
        return (
          <button
            key={filtro}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => select(filtro)}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors sm:px-2.5 sm:text-sm",
              active && "bg-background text-foreground shadow-sm",
            )}
          >
            {PALLINO[filtro] && <span aria-hidden className={cn("size-2 rounded-full", PALLINO[filtro])} />}
            {ETICHETTE_AMBITO[filtro]}
          </button>
        );
      })}
    </div>
  );
}
