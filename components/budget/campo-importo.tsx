"use client";

import { cn } from "@/lib/utils";

/** Importo grande con tastierino decimale sul telefono. */
export function CampoImporto({
  value,
  onChange,
  id,
  autoFocus,
  invalid,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  autoFocus?: boolean;
  invalid?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-baseline justify-center gap-2 rounded-xl bg-muted/60 px-4 py-5 ring-1 ring-black/8 ring-inset focus-within:ring-2 focus-within:ring-ring/50",
        invalid && "ring-destructive/50",
        className,
      )}
    >
      <span className="text-2xl text-muted-foreground">€</span>
      <input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        inputMode="decimal"
        autoFocus={autoFocus}
        placeholder="0,00"
        aria-invalid={invalid || undefined}
        className="w-40 bg-transparent text-center text-4xl font-semibold tabular-nums outline-none placeholder:text-muted-foreground/50"
      />
    </div>
  );
}
