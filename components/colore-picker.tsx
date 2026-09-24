"use client";

import { COLORI } from "@/lib/colori";
import { cn } from "@/lib/utils";

/** Scelta di un colore dalla tavolozza, più uno personalizzato. "" = nessuno. */
export function ColorePicker({ value, onChange, id }: { value: string; onChange: (value: string) => void; id?: string }) {
  return (
    <div className="flex flex-wrap items-center gap-2" id={id}>
      {COLORI.map((c) => (
        <button
          key={c}
          type="button"
          aria-label={c}
          aria-pressed={value === c}
          onClick={() => onChange(value === c ? "" : c)}
          className={cn("size-7 rounded-full ring-offset-2 transition-transform", value === c && "scale-110 ring-2 ring-foreground/60")}
          style={{ backgroundColor: c }}
        />
      ))}
      <input
        type="color"
        value={value || "#8e8e93"}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Colore personalizzato"
        className="size-7 cursor-pointer rounded-full border-0 bg-transparent p-0"
      />
      {value && (
        <button type="button" className="text-xs text-muted-foreground underline underline-offset-4" onClick={() => onChange("")}>
          Nessuno
        </button>
      )}
    </div>
  );
}
