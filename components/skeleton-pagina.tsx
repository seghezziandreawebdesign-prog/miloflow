import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Scheletro mostrato dai loading.tsx durante la navigazione: titolo vero
 * della sezione subito, chip e righe finte finché arrivano i dati.
 */
export function SkeletonPagina({
  titolo,
  chips = true,
  righe = 8,
}: {
  titolo: string;
  chips?: boolean;
  righe?: number;
}) {
  return (
    <>
      <PageHeader title={titolo} description={<Skeleton className="h-4 w-40" />} />
      {chips && (
        <div className="mb-4 flex flex-wrap gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-24 rounded-full" />
          ))}
        </div>
      )}
      <div className="space-y-2">
        {Array.from({ length: righe }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-xl" />
        ))}
      </div>
    </>
  );
}
