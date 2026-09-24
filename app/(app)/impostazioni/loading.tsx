import { SkeletonPagina } from "@/components/skeleton-pagina";

export default function Loading() {
  return <SkeletonPagina titolo="Impostazioni" chips={false} righe={5} />;
}
