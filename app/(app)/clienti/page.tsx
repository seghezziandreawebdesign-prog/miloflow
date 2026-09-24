import { Building2 } from "lucide-react";
import type { Metadata } from "next";

import { AmbitoBadge } from "@/components/ambito-badge";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { getFiltroAmbito } from "@/lib/ambito.server";

export const metadata: Metadata = { title: "Clienti" };

export default async function Page() {
  const filtroAmbito = await getFiltroAmbito();

  return (
    <>
      <PageHeader
        title="Clienti"
        description={
          <>
            Ambito: <AmbitoBadge ambito={filtroAmbito} className="align-middle" />
          </>
        }
      />
      <EmptyState icon={Building2} title="Nessun cliente" description="Aggiungi il primo cliente partendo dalla partita IVA (fase 2)." />
    </>
  );
}
