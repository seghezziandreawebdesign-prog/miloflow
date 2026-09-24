"use client";

import { createContext, useContext, useRef } from "react";

import { cn } from "@/lib/utils";

/** Funzione che chiude il dialog o il foglio che contiene la maniglia. */
export const ChiusuraContext = createContext<(() => void) | null>(null);

const SOGLIA_PX = 90;

/**
 * Maniglia in cima a un foglio che sale dal basso: trascinandola verso il
 * basso il foglio segue il dito e, oltre la soglia, si chiude.
 */
export function ManigliaTrascina({ className }: { className?: string }) {
  const chiudi = useContext(ChiusuraContext);
  const stato = useRef<{ y: number; el: HTMLElement } | null>(null);

  function contenitore(target: EventTarget): HTMLElement | null {
    return (target as HTMLElement).closest("[data-slot=dialog-content],[data-slot=sheet-content]");
  }

  return (
    <div
      aria-hidden
      className={cn("-mt-1 flex cursor-grab touch-none justify-center py-2.5 select-none active:cursor-grabbing", className)}
      onPointerDown={(e) => {
        const el = contenitore(e.currentTarget);
        if (!el) return;
        stato.current = { y: e.clientY, el };
        el.style.transition = "none";
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        if (!stato.current) return;
        const dy = Math.max(0, e.clientY - stato.current.y);
        stato.current.el.style.transform = `translateY(${dy}px)`;
      }}
      onPointerUp={(e) => {
        if (!stato.current) return;
        const { y, el } = stato.current;
        stato.current = null;
        const dy = e.clientY - y;
        if (dy > SOGLIA_PX && chiudi) {
          chiudi();
          return;
        }
        el.style.transition = "";
        el.style.transform = "";
      }}
      onPointerCancel={() => {
        if (!stato.current) return;
        stato.current.el.style.transition = "";
        stato.current.el.style.transform = "";
        stato.current = null;
      }}
    >
      <span className="h-1 w-9 rounded-full bg-black/15" />
    </div>
  );
}
