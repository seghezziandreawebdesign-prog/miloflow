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
    <div role="radiogroup" aria-label="Ambito" className="inline-flex rounded-[10px] bg-black/6 p-[3px]">
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
              "flex items-center gap-1.5 rounded-[8px] px-2 py-1 text-xs font-medium text-muted-foreground transition-[background-color,box-shadow,color] outline-none focus-visible:ring-2 focus-visible:ring-ring/50 sm:px-2.5 sm:text-[13px]",
              active && "bg-white text-foreground shadow-[0_1px_3px_rgba(0,0,0,0.12),0_0_0_0.5px_rgba(0,0,0,0.04)]",
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
