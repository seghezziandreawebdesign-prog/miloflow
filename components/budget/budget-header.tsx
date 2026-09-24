"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { AmbitoBadge } from "@/components/ambito-badge";
import { PageHeader } from "@/components/page-header";
import { Segmented } from "@/components/segmented";
import { Button, buttonVariants } from "@/components/ui/button";
import type { FiltroAmbito } from "@/lib/ambito";
import { aggiungiMesi, formatMese, PERIODI_REPORT, primoDelMese, type PeriodoReport } from "@/lib/budget";
import { capitalize, todayISO } from "@/lib/dates/format";
import { cn } from "@/lib/utils";

export type TabBudget = "mese" | "debiti" | "report";

const TABS = [
  { value: "mese", label: "Mese" },
  { value: "debiti", label: "Debiti" },
  { value: "report", label: "Report" },
] as const;

export function hrefBudget(tab: TabBudget, extra: Record<string, string> = {}) {
  const params = new URLSearchParams({ tab, ...extra });
  return `/budget?${params.toString()}`;
}

/** Intestazione della sezione Budget: tab, mese (con frecce) o periodo dei report. */
export function BudgetHeader({
  tab,
  mese,
  periodo,
  filtroAmbito,
}: {
  tab: TabBudget;
  mese: string;
  periodo: PeriodoReport;
  filtroAmbito: FiltroAmbito;
}) {
  const router = useRouter();
  const meseCorrente = primoDelMese(todayISO());

  return (
    <div className="mb-4 space-y-3">
      <PageHeader
        title="Budget"
        description={
          <>
            Spese, previsti, debiti e report. Ambito: <AmbitoBadge ambito={filtroAmbito} className="align-middle" />
          </>
        }
        actions={
          <Segmented
            label="Sezione"
            value={tab}
            onChange={(t) => router.push(hrefBudget(t, t === "mese" ? { mese } : t === "report" ? { periodo } : {}))}
            opzioni={TABS}
            className="[&>p]:sr-only"
          />
        }
      />
      {tab === "mese" && (
        <div className="flex flex-wrap items-center gap-2">
          <Link href={hrefBudget("mese", { mese: aggiungiMesi(mese, -1) })} aria-label="Mese precedente" className={buttonVariants({ variant: "outline", size: "icon" })}>
            <ChevronLeft />
          </Link>
          <Link href={hrefBudget("mese", { mese: aggiungiMesi(mese, 1) })} aria-label="Mese successivo" className={buttonVariants({ variant: "outline", size: "icon" })}>
            <ChevronRight />
          </Link>
          <h2 className="min-w-0 text-lg font-semibold tracking-tight">{capitalize(formatMese(mese))}</h2>
          {mese !== meseCorrente && (
            <Button variant="ghost" size="sm" onClick={() => router.push(hrefBudget("mese", { mese: meseCorrente }))}>
              Oggi
            </Button>
          )}
        </div>
      )}
      {tab === "report" && (
        <div className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-0.5 scrollbar-none sm:mx-0 sm:px-0">
          {PERIODI_REPORT.map((p) => (
            <Link
              key={p.value}
              href={hrefBudget("report", { periodo: p.value })}
              className={cn(
                "inline-flex h-8 shrink-0 items-center rounded-full px-3 text-[13px] whitespace-nowrap ring-1 ring-inset transition-colors",
                periodo === p.value ? "bg-primary-soft font-medium text-primary ring-primary/15" : "bg-card ring-black/8 hover:bg-muted",
              )}
            >
              {p.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
