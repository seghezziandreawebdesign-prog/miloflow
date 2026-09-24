import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export type OpzioneSegmented<T extends string> = {
  value: T;
  label: string;
  icon?: LucideIcon;
  /** Numero mostrato accanto all'etichetta (es. contatori). */
  conteggio?: number;
  /** Colore del numero quando è maggiore di zero. */
  tono?: string;
};

/**
 * Scelta tra poche opzioni, come il segmented control di iOS.
 * `label` vuota: nessuna etichetta visibile. `size="lg"` per i contatori.
 */
export function Segmented<T extends string>({
  label,
  value,
  onChange,
  opzioni,
  size = "default",
  soloIcone,
  className,
}: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  opzioni: readonly OpzioneSegmented<T>[];
  size?: "default" | "lg";
  /** Su schermi stretti mostra solo l'icona. */
  soloIcone?: "mobile";
  className?: string;
}) {
  return (
    <div className={cn(label && "space-y-2", className)}>
      {label && <p className="text-sm font-medium">{label}</p>}
      <div
        role="radiogroup"
        aria-label={label || undefined}
        className={cn(
          "inline-flex max-w-full rounded-[10px] bg-black/6 p-[3px]",
          size === "lg" ? "w-full gap-0.5" : "flex-wrap",
        )}
      >
        {opzioni.map((o) => {
          const active = value === o.value;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={o.label}
              onClick={() => onChange(o.value)}
              className={cn(
                "inline-flex items-center justify-center gap-1.5 rounded-[8px] text-muted-foreground transition-[background-color,box-shadow,color] outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                size === "lg" ? "min-w-0 flex-1 flex-col gap-0 px-2 py-1.5" : "px-3 py-1 text-sm",
                active && "bg-white font-medium text-foreground shadow-[0_1px_3px_rgba(0,0,0,0.12),0_0_0_0.5px_rgba(0,0,0,0.04)]",
              )}
            >
              {o.icon && <o.icon className="size-4 shrink-0" />}
              {o.conteggio !== undefined && (
                <span
                  className={cn(
                    "text-xl leading-tight font-semibold tracking-tight tabular-nums",
                    o.conteggio > 0 && o.tono ? o.tono : "text-foreground",
                    o.conteggio === 0 && "text-muted-foreground",
                  )}
                >
                  {o.conteggio}
                </span>
              )}
              <span className={cn(soloIcone === "mobile" && o.icon && "hidden sm:inline", size === "lg" && "text-xs")}>
                {o.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
