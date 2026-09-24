import { SkeletonPagina } from "@/components/skeleton-pagina";

export default function Loading() {
  return <SkeletonPagina titolo="Oggi" chips={false} righe={6} />;
}
