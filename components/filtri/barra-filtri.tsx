"use client";

import { Search, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Barra dei filtri. Su desktop tutto su una riga che va a capo: ricerca,
 * chip, "Azzera" e a destra le azioni. Su mobile la ricerca sta sopra
 * (con le azioni) e le chip scorrono in orizzontale.
 */
export function BarraFiltri({
  ricerca,
  destra,
  azzera,
  children,
  className,
}: {
  ricerca?: React.ReactNode;
  destra?: React.ReactNode;
  /** Se presente, mostra "Azzera" dopo le chip. */
  azzera?: (() => void) | null;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center", className)}>
      {(ricerca || destra) && (
        <div className="flex items-center gap-2 sm:contents">
          {ricerca && <div className="min-w-0 flex-1 sm:w-64 sm:flex-none">{ricerca}</div>}
          {destra && <div className="flex shrink-0 items-center gap-2 sm:order-last sm:ml-auto">{destra}</div>}
        </div>
      )}
      <div className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-0.5 scrollbar-none sm:contents">
        {children}
        {azzera && (
          <button
            type="button"
            onClick={azzera}
            className="inline-flex h-8 shrink-0 items-center gap-1 rounded-full px-2.5 text-[13px] font-medium text-primary hover:bg-primary-soft"
          >
            <X className="size-3.5" />
            Azzera
          </button>
        )}
      </div>
    </div>
  );
}

export function CampoRicerca({
  value,
  onChange,
  placeholder,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  label: string;
}) {
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={label}
        className="h-8 rounded-full border-transparent bg-card pl-9 ring-1 ring-black/8 ring-inset placeholder:text-muted-foreground/80 focus-visible:ring-ring"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Cancella la ricerca"
          className="absolute top-1/2 right-2 grid size-5 -translate-y-1/2 place-items-center rounded-full bg-muted-foreground/20 text-background hover:bg-muted-foreground/40"
        >
          <X className="size-3" />
        </button>
      )}
    </div>
  );
}
