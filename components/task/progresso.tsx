import { avanzamento } from "@/lib/task";
import { cn } from "@/lib/utils";

/** Barra di avanzamento di un progetto: task fatte su totali. */
export function Progresso({
  fatte,
  totali,
  colore,
  className,
}: {
  fatte: number;
  totali: number;
  colore?: string | null;
  className?: string;
}) {
  const percentuale = avanzamento(fatte, totali);
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percentuale}
        aria-label={`${fatte} task fatte su ${totali}`}
        className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"
      >
        <div
          className="h-full rounded-full bg-primary transition-[width]"
          style={{ width: `${percentuale}%`, ...(colore ? { backgroundColor: colore } : {}) }}
        />
      </div>
      <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
        {fatte}/{totali}
      </span>
    </div>
  );
}
