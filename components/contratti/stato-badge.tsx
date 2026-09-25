import { statoContratto, type StatoContratto } from "@/lib/contratti";
import { cn } from "@/lib/utils";

export function StatoContrattoBadge({ stato, className }: { stato: StatoContratto; className?: string }) {
  const s = statoContratto(stato);
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        s.className,
        className,
      )}
    >
      {s.label}
    </span>
  );
}
