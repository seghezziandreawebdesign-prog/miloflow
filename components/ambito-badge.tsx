import { ETICHETTE_AMBITO, type FiltroAmbito } from "@/lib/ambito";
import { cn } from "@/lib/utils";

const STILI: Record<FiltroAmbito, string> = {
  tutto: "bg-muted text-muted-foreground",
  lavoro: "bg-ambito-lavoro-soft text-ambito-lavoro",
  personale: "bg-ambito-personale-soft text-ambito-personale",
};

export function AmbitoBadge({ ambito, className }: { ambito: FiltroAmbito; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        STILI[ambito],
        className,
      )}
    >
      {ETICHETTE_AMBITO[ambito]}
    </span>
  );
}
