import { formatCurrency } from "@/lib/dates/format";
import { cn } from "@/lib/utils";

/** Pezzi comuni delle pagine di stampa del budget (mese e report). */

export function Contatore({ label, valore, negativo }: { label: string; valore: number; negativo?: boolean }) {
  return (
    <div className="rounded-lg bg-muted/50 px-3 py-2 print:bg-transparent print:ring-1 print:ring-black/15">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={cn("text-lg font-semibold tabular-nums tracking-tight", negativo && "text-destructive")}>{formatCurrency(valore)}</dd>
    </div>
  );
}

export function Sezione({ titolo, children }: { titolo: string; children: React.ReactNode }) {
  return (
    <section className="mb-6 break-inside-avoid">
      <h2 className="mb-2 text-base font-semibold">{titolo}</h2>
      {children}
    </section>
  );
}

export function Vuoto() {
  return <p className="text-xs text-muted-foreground">Niente da mostrare.</p>;
}
