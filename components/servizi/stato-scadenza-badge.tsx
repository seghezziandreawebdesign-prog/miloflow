import { STATI_SCADENZA, type StatoScadenza } from "@/lib/servizi";
import { cn } from "@/lib/utils";

function descrizione(giorni: number): string {
  if (giorni < -1) return `scaduto da ${-giorni} giorni`;
  if (giorni === -1) return "scaduto ieri";
  if (giorni === 0) return "scade oggi";
  if (giorni === 1) return "scade domani";
  return `tra ${giorni} giorni`;
}

export function StatoScadenzaBadge({
  stato,
  giorni,
  className,
}: {
  stato: StatoScadenza;
  giorni: number;
  className?: string;
}) {
  const s = STATI_SCADENZA[stato];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset",
        s.className,
        className,
      )}
      title={s.label}
    >
      <span aria-hidden className={cn("size-1.5 rounded-full", s.dot)} />
      {stato === "senza_scadenza" ? s.label : descrizione(giorni)}
    </span>
  );
}
