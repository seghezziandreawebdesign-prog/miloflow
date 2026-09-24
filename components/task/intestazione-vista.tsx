import { cn } from "@/lib/utils";

/** Intestazione del contenuto della pagina Task (vista o progetto). */
export function IntestazioneVista({
  titolo,
  descrizione,
  conteggio,
  prima,
  azioni,
  className,
}: {
  titolo: React.ReactNode;
  descrizione?: React.ReactNode;
  conteggio?: number;
  /** Contenuto sopra il titolo (es. link indietro). */
  prima?: React.ReactNode;
  azioni?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-x-4 gap-y-2", className)}>
      <div className="min-w-0">
        {prima}
        <h1 className="flex items-center gap-2 text-[22px] font-semibold tracking-tight">
          <span className="truncate">{titolo}</span>
          {conteggio !== undefined && conteggio > 0 && (
            <span className="rounded-full bg-black/6 px-2 py-0.5 text-xs font-medium text-muted-foreground tabular-nums">{conteggio}</span>
          )}
        </h1>
        {descrizione && <div className="mt-0.5 text-sm text-muted-foreground">{descrizione}</div>}
      </div>
      {azioni && <div className="flex shrink-0 items-center gap-2">{azioni}</div>}
    </div>
  );
}
