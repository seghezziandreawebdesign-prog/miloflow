"use client";

import { ChevronLeft, ChevronRight, Printer } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { AmbitoBadge } from "@/components/ambito-badge";
import { DatePicker } from "@/components/date-picker";
import { PageHeader } from "@/components/page-header";
import { Segmented } from "@/components/segmented";
import { Button, buttonVariants } from "@/components/ui/button";
import type { FiltroAmbito } from "@/lib/ambito";
import { aggiungiMesi, formatMese, PERIODI_REPORT, primoDelMese, type SceltaReport } from "@/lib/budget";
import { capitalize, todayISO } from "@/lib/dates/format";
import { cn } from "@/lib/utils";

export type TabBudget = "mese" | "debiti" | "risparmi" | "investimenti" | "report";

const TABS = [
  { value: "mese", label: "Mese" },
  { value: "debiti", label: "Debiti" },
  { value: "risparmi", label: "Risparmi" },
  { value: "investimenti", label: "Investimenti" },
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
  report,
  filtroAmbito,
}: {
  tab: TabBudget;
  mese: string;
  report: SceltaReport;
  filtroAmbito: FiltroAmbito;
}) {
  const router = useRouter();
  const meseCorrente = primoDelMese(todayISO());
  const parametriReport = (r: SceltaReport): Record<string, string> =>
    r.periodo === "personalizzato" ? { periodo: r.periodo, dal: r.dal, al: r.al } : { periodo: r.periodo };
  // Un estremo che scavalca l'altro lo trascina con sé.
  function scegliIntervallo(dal: string, al: string) {
    router.push(hrefBudget("report", { periodo: "personalizzato", dal, al }));
  }

  return (
    <div className="mb-4 space-y-3">
      <PageHeader
        title="Budget & Spese"
        description={
          <>
            Spese, previsti, debiti, risparmi, investimenti e report. Ambito: <AmbitoBadge ambito={filtroAmbito} className="align-middle" />
          </>
        }
        actions={
          <Segmented
            label="Sezione"
            value={tab}
            onChange={(t) => router.push(hrefBudget(t, t === "mese" ? { mese } : t === "report" ? parametriReport(report) : {}))}
            opzioni={TABS}
            // Su mobile le cinque sezioni scorrono su una riga invece di andare a capo.
            className="scrollbar-none [&>p]:sr-only max-sm:-mx-4 max-sm:w-[calc(100%+2rem)] max-sm:overflow-x-auto max-sm:px-4 max-sm:[&>div]:max-w-none max-sm:[&>div]:flex-nowrap max-sm:[&_button]:shrink-0"
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
          <Link href={`/budget/stampa?mese=${mese}`} className={cn(buttonVariants({ variant: "outline", size: "sm" }), "ml-auto")}>
            <Printer />
            Esporta PDF
          </Link>
        </div>
      )}
      {tab === "report" && (
        <div className="space-y-3">
          <div className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-0.5 scrollbar-none sm:mx-0 sm:px-0">
            <Link
              href={`/budget/stampa/report?${new URLSearchParams(parametriReport(report)).toString()}`}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "order-last ml-auto shrink-0")}
            >
              <Printer />
              Esporta PDF
            </Link>
            {PERIODI_REPORT.map((p) => (
              <Link
                key={p.value}
                href={hrefBudget(
                  "report",
                  // "Personalizzato" parte dall'intervallo che stai guardando.
                  p.value === "personalizzato" ? { periodo: p.value, dal: report.dal, al: report.al } : { periodo: p.value },
                )}
                className={cn(
                  "inline-flex h-8 shrink-0 items-center rounded-full px-3 text-[13px] whitespace-nowrap ring-1 ring-inset transition-colors",
                  report.periodo === p.value ? "bg-primary-soft font-medium text-primary ring-primary/15" : "bg-card ring-black/8 hover:bg-muted",
                )}
              >
                {p.label}
              </Link>
            ))}
          </div>
          {report.periodo === "personalizzato" && (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted-foreground">Dal</span>
              <DatePicker
                size="sm"
                value={report.dal}
                onChange={(dal) => dal && scegliIntervallo(dal, dal > report.al ? dal : report.al)}
                className="w-36"
              />
              <span className="text-muted-foreground">al</span>
              <DatePicker
                size="sm"
                value={report.al}
                onChange={(al) => al && scegliIntervallo(al < report.dal ? al : report.dal, al)}
                className="w-36"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
