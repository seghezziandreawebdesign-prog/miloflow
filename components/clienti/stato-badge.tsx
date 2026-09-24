import { statoCliente, type StatoCliente } from "@/lib/clienti";
import { cn } from "@/lib/utils";

export function StatoClienteBadge({ stato, className }: { stato: StatoCliente; className?: string }) {
  const s = statoCliente(stato);
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
