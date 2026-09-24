"use client";

import { Settings } from "lucide-react";
import Link from "next/link";
import { useCallback, useSyncExternalStore } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { coloriEvento, TIPI_CALENDARIO, TUTTI_I_TIPI, type TipoCalendario } from "@/lib/calendario";
import { cn } from "@/lib/utils";

const CHIAVE = "calendario.filtri";
const listeners = new Set<() => void>();

function leggi(): string {
  try {
    return localStorage.getItem(CHIAVE) ?? "";
  } catch {
    return "";
  }
}

function analizza(raw: string): Set<TipoCalendario> {
  if (!raw) return new Set(TUTTI_I_TIPI);
  try {
    const lista = JSON.parse(raw);
    if (!Array.isArray(lista)) return new Set(TUTTI_I_TIPI);
    return new Set(lista.filter((t): t is TipoCalendario => TUTTI_I_TIPI.includes(t)));
  } catch {
    return new Set(TUTTI_I_TIPI);
  }
}

/** Tipi visibili nel calendario, ricordati nel browser. */
export function useFiltriCalendario(): [Set<TipoCalendario>, (next: Set<TipoCalendario>) => void] {
  const subscribe = useCallback((notify: () => void) => {
    listeners.add(notify);
    window.addEventListener("storage", notify);
    return () => {
      listeners.delete(notify);
      window.removeEventListener("storage", notify);
    };
  }, []);
  const raw = useSyncExternalStore(subscribe, leggi, () => "");
  const set = useCallback((next: Set<TipoCalendario>) => {
    try {
      localStorage.setItem(CHIAVE, JSON.stringify([...next]));
    } catch {
      // storage non disponibile: la scelta vale finché la pagina resta aperta
    }
    for (const notify of listeners) notify();
  }, []);
  return [analizza(raw), set];
}

/** Colonna sinistra (desktop) o riga di chip (mobile) per scegliere cosa vedere. */
export function FiltriCalendario({
  attivi,
  onChange,
  compatto,
}: {
  attivi: Set<TipoCalendario>;
  onChange: (next: Set<TipoCalendario>) => void;
  /** Riga di chip che scorre (mobile). */
  compatto?: boolean;
}) {
  function toggle(tipo: TipoCalendario) {
    const next = new Set(attivi);
    if (next.has(tipo)) next.delete(tipo);
    else next.add(tipo);
    onChange(next);
  }

  if (compatto) {
    return (
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-0.5 scrollbar-none" role="group" aria-label="Cosa vedere">
        {TIPI_CALENDARIO.map((t) => {
          const on = attivi.has(t.value);
          const c = coloriEvento(t.value, "lavoro", null);
          return (
            <button
              key={t.value}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(t.value)}
              className={cn(
                "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-[13px] whitespace-nowrap ring-1 ring-inset",
                on ? "bg-card font-medium ring-black/8" : "bg-transparent text-muted-foreground ring-black/8 line-through decoration-muted-foreground/50",
              )}
            >
              <span className="size-2.5 rounded-full" style={{ backgroundColor: on ? c.textColor : "#c7c7cc" }} />
              {t.label}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <div className="mb-1.5 flex items-center justify-between px-1">
          <p className="text-[11px] font-semibold tracking-wider text-muted-foreground/80 uppercase">Mostra</p>
          <button
            type="button"
            className="text-xs text-primary hover:underline"
            onClick={() => onChange(attivi.size === TUTTI_I_TIPI.length ? new Set() : new Set(TUTTI_I_TIPI))}
          >
            {attivi.size === TUTTI_I_TIPI.length ? "Nessuno" : "Tutti"}
          </button>
        </div>
        <ul className="space-y-0.5">
          {TIPI_CALENDARIO.map((t) => {
            const on = attivi.has(t.value);
            const c = coloriEvento(t.value, "lavoro", null);
            const id = `filtro-cal-${t.value}`;
            return (
              <li key={t.value}>
                <label
                  htmlFor={id}
                  className={cn(
                    "flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm hover:bg-black/4",
                    !on && "text-muted-foreground",
                  )}
                >
                  <Checkbox id={id} checked={on} onCheckedChange={() => toggle(t.value)} />
                  <span
                    className="size-2.5 shrink-0 rounded-sm"
                    style={{ backgroundColor: t.value === "evento" ? c.backgroundColor : c.textColor }}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block leading-tight">{t.label}</span>
                    <span className="block text-[11px] leading-tight text-muted-foreground">{t.descrizione}</span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      </div>
      <div className="px-1 text-xs text-muted-foreground">
        <p className="mb-1.5">Colori: blu lavoro, viola personale. Il bordo è il colore del progetto.</p>
        <Link href="/impostazioni#calendario" className="inline-flex items-center gap-1 text-primary hover:underline">
          <Settings className="size-3.5" />
          Tacche, orari e feed ICS
        </Link>
      </div>
    </div>
  );
}
