import { SkeletonPagina } from "@/components/skeleton-pagina";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <>
      <SkeletonPagina titolo="Calendario" chips righe={0} />
      <Skeleton className="h-[60svh] w-full rounded-xl" />
    </>
  );
}
