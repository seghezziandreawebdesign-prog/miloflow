"use client";

import { ChevronDown } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export type OpzioneFiltro = { value: string; label: string };

/**
 * Filtro a pillola: mostra etichetta e valore scelto, si colora quando il
 * valore non è quello neutro e apre un menu con le opzioni.
 */
export function FiltroChip({
  label,
  value,
  onChange,
  opzioni,
  neutro = opzioni[0]?.value,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  opzioni: OpzioneFiltro[];
  /** Valore che significa "nessun filtro" (default: la prima opzione). */
  neutro?: string;
  disabled?: boolean;
}) {
  const attivo = value !== neutro;
  const scelta = opzioni.find((o) => o.value === value)?.label ?? "";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={disabled}
        aria-label={`${label}: ${scelta}`}
        className={cn(
          "inline-flex h-8 shrink-0 items-center gap-1 rounded-full pr-2 pl-3 text-[13px] whitespace-nowrap transition-colors outline-none select-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50",
          attivo
            ? "bg-primary-soft font-medium text-primary ring-1 ring-primary/15 ring-inset hover:bg-primary/12"
            : "bg-card text-foreground ring-1 ring-black/8 ring-inset hover:bg-muted",
        )}
      >
        <span className={cn(attivo ? "text-primary/70" : "text-muted-foreground")}>{label}</span>
        <span className="max-w-40 truncate">{scelta}</span>
        <ChevronDown className="size-3.5 opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-auto min-w-48">
        <DropdownMenuRadioGroup value={value} onValueChange={(v) => onChange(String(v))}>
          {opzioni.map((o) => (
            <DropdownMenuRadioItem key={o.value} value={o.value}>
              {o.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
