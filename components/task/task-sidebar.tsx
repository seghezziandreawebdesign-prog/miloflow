"use client";

import { CalendarRange, ChevronDown, FolderKanban, Hourglass, Inbox, LayoutGrid, ListChecks, Plus, Sun, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";

import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import type { FiltroAmbito } from "@/lib/ambito";
import { todayISO } from "@/lib/dates/format";
import { avanzamento, isInbox, taskDiOggi } from "@/lib/task";
import { cn } from "@/lib/utils";

import { useProgetti, useTaskAperte } from "./dati";
import { useNuovoProgetto } from "./nuova-task";
import { VISTE, type Vista } from "./viste";

const ICONE: Record<Vista, LucideIcon> = {
  inbox: Inbox,
  oggi: Sun,
  settimana: CalendarRange,
  attesa: Hourglass,
  pianifica: LayoutGrid,
  tutte: ListChecks,
  progetti: FolderKanban,
};

const VISTE_COLONNA: Vista[] = ["inbox", "oggi", "settimana", "attesa", "pianifica"];

function useSelezione() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const progettoId = pathname.match(/^\/task\/progetti\/([^/]+)/)?.[1] ?? null;
  const param = searchParams.get("vista");
  const vista: Vista | null = progettoId ? null : VISTE.some((v) => v.value === param) ? (param as Vista) : "oggi";
  return { progettoId, vista };
}

/** Colonna sinistra su desktop; su mobile un selettore che apre un foglio dal basso. */
export function TaskSidebar({ filtroAmbito }: { filtroAmbito: FiltroAmbito }) {
  const { progettoId, vista } = useSelezione();
  const { data: progetti } = useProgetti(filtroAmbito);
  const [aperto, setAperto] = useState(false);

  const progettoCorrente = progetti?.find((p) => p.id === progettoId);
  const etichetta = progettoId
    ? (progettoCorrente?.nome ?? "Progetto")
    : (VISTE.find((v) => v.value === vista)?.label ?? "Task");

  return (
    <>
      <aside className="sticky top-[4.5rem] hidden max-h-[calc(100svh-5.5rem)] overflow-y-auto pr-1 lg:block">
        <Contenuto filtroAmbito={filtroAmbito} progettoId={progettoId} vista={vista} />
      </aside>

      <div className="lg:hidden">
        <button
          type="button"
          onClick={() => setAperto(true)}
          aria-haspopup="dialog"
          className="inline-flex max-w-full items-center gap-2 rounded-full bg-card py-1.5 pr-3 pl-4 text-[15px] font-semibold ring-1 ring-black/8 active:bg-muted"
        >
          {progettoCorrente?.colore && <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: progettoCorrente.colore }} />}
          <span className="truncate">{etichetta}</span>
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
        </button>
        <Sheet open={aperto} onOpenChange={setAperto}>
          <SheetContent
            side="bottom"
            showCloseButton={false}
            className="max-h-[85svh] overflow-y-auto rounded-t-2xl p-3 pb-[max(1rem,env(safe-area-inset-bottom))]"
          >
            <SheetTitle className="sr-only">Viste e progetti</SheetTitle>
            <div className="mx-auto mb-2 h-1 w-9 rounded-full bg-black/15" aria-hidden />
            <Contenuto filtroAmbito={filtroAmbito} progettoId={progettoId} vista={vista} onNavigate={() => setAperto(false)} large />
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}

function Contenuto({
  filtroAmbito,
  progettoId,
  vista,
  onNavigate,
  large,
}: {
  filtroAmbito: FiltroAmbito;
  progettoId: string | null;
  vista: Vista | null;
  onNavigate?: () => void;
  large?: boolean;
}) {
  const { data: tasks } = useTaskAperte(filtroAmbito);
  const { data: progetti } = useProgetti(filtroAmbito);
  const nuovoProgetto = useNuovoProgetto();
  const oggi = todayISO();
  const tutte = tasks ?? [];
  const perOggi = taskDiOggi(tutte, oggi);
  const conteggi: Partial<Record<Vista, number>> = {
    inbox: tutte.filter(isInbox).length,
    oggi: perOggi.inRitardo.length + perOggi.perOggi.length,
    attesa: tutte.filter((t) => t.stato === "in_attesa").length,
  };
  const correnti = (progetti ?? []).filter((p) => p.stato === "attivo" || p.stato === "in_pausa");

  return (
    <nav className="flex flex-col gap-0.5" aria-label="Viste e progetti">
      <Gruppo>Viste</Gruppo>
      {VISTE_COLONNA.map((v) => {
        const Icona = ICONE[v];
        return (
          <Voce key={v} href={`/task?vista=${v}`} attiva={vista === v} onNavigate={onNavigate} large={large}>
            <Icona className={cn("size-4 shrink-0", vista === v ? "text-primary" : "text-muted-foreground")} />
            <span className="truncate">{VISTE.find((x) => x.value === v)?.label}</span>
            {(conteggi[v] ?? 0) > 0 && <span className="ml-auto text-xs text-muted-foreground tabular-nums">{conteggi[v]}</span>}
          </Voce>
        );
      })}

      <Gruppo className="mt-3">Progetti</Gruppo>
      <Voce href="/task?vista=tutte" attiva={vista === "tutte"} onNavigate={onNavigate} large={large}>
        <ListChecks className={cn("size-4 shrink-0", vista === "tutte" ? "text-primary" : "text-muted-foreground")} />
        Tutte le task
      </Voce>
      {correnti.map((p) => {
        const attiva = p.id === progettoId;
        return (
          <Voce key={p.id} href={`/task/progetti/${p.id}`} attiva={attiva} onNavigate={onNavigate} large={large}>
            <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: p.colore ?? "var(--muted-foreground)" }} />
            <span className={cn("truncate", p.stato === "in_pausa" && "text-muted-foreground")}>{p.nome}</span>
            <span
              className="ml-auto h-1 w-8 shrink-0 overflow-hidden rounded-full bg-black/8"
              title={`${p.task_fatte ?? 0} task fatte su ${p.task_totali ?? 0}`}
            >
              <span
                className="block h-full rounded-full"
                style={{ width: `${avanzamento(p.task_fatte ?? 0, p.task_totali ?? 0)}%`, backgroundColor: p.colore ?? "var(--primary)" }}
              />
            </span>
          </Voce>
        );
      })}
      <Voce href="/task?vista=progetti" attiva={vista === "progetti"} onNavigate={onNavigate} large={large}>
        <FolderKanban className={cn("size-4 shrink-0", vista === "progetti" ? "text-primary" : "text-muted-foreground")} />
        Tutti i progetti
      </Voce>
      <button
        type="button"
        onClick={() => {
          onNavigate?.();
          nuovoProgetto();
        }}
        className={cn(
          "flex items-center gap-2.5 rounded-lg px-2.5 text-left text-primary hover:bg-primary-soft",
          large ? "py-2.5 text-[15px]" : "py-1.5 text-sm",
        )}
      >
        <Plus className="size-4 shrink-0" />
        Nuovo progetto
      </button>
    </nav>
  );
}

function Gruppo({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={cn("px-2.5 pb-1 text-[11px] font-semibold tracking-wider text-muted-foreground/80 uppercase", className)}>{children}</p>
  );
}

function Voce({
  href,
  attiva,
  onNavigate,
  large,
  children,
}: {
  href: string;
  attiva: boolean;
  onNavigate?: () => void;
  large?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={attiva ? "page" : undefined}
      className={cn(
        "flex items-center gap-2.5 rounded-lg px-2.5 transition-colors",
        large ? "py-2.5 text-[15px]" : "py-1.5 text-sm",
        attiva ? "bg-primary-soft font-medium text-primary" : "text-foreground hover:bg-black/4",
      )}
    >
      {children}
    </Link>
  );
}
