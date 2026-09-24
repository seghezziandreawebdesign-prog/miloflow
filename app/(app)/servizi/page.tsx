import { RefreshCw } from "lucide-react";
import type { Metadata } from "next";

import { AmbitoBadge } from "@/components/ambito-badge";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { getFiltroAmbito } from "@/lib/ambito.server";

export const metadata: Metadata = { title: "Servizi & Scadenze" };

export default async function Page() {
  const filtroAmbito = await getFiltroAmbito();

  return (
    <>
      <PageHeader
        title="Servizi & Scadenze"
        description={
          <>
            Ambito: <AmbitoBadge ambito={filtroAmbito} className="align-middle" />
          </>
        }
      />
      <EmptyState icon={RefreshCw} title="Nessun servizio" description="Aggiungi il primo servizio: domini, hosting, licenze e abbonamenti (fase 2)." />
    </>
  );
}
