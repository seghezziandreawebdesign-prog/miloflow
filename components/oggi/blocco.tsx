import { ArrowRight, type LucideIcon } from "lucide-react";
import Link from "next/link";

/** Riquadro della pagina Oggi, con titolo e link alla sezione completa. */
export function Blocco({
  titolo,
  icona: Icona,
  descrizione,
  link,
  children,
}: {
  titolo: string;
  icona?: LucideIcon;
  descrizione?: string;
  link?: { href: string; label: string };
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl bg-card p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-black/8">
      <div className="mb-3 flex items-start gap-2">
        {Icona && <Icona className="mt-0.5 size-4 text-primary" />}
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold">{titolo}</h2>
          {descrizione && <p className="text-xs text-muted-foreground">{descrizione}</p>}
        </div>
        {link && (
          <Link href={link.href} className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-primary hover:underline">
            {link.label}
            <ArrowRight className="size-3" />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}
