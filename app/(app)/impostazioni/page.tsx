import { Settings } from "lucide-react";
import type { Metadata } from "next";

import { AmbitoBadge } from "@/components/ambito-badge";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { getFiltroAmbito } from "@/lib/ambito.server";

export const metadata: Metadata = { title: "Impostazioni" };

export default async function Page() {
  const filtroAmbito = await getFiltroAmbito();

  return (
    <>
      <PageHeader
        title="Impostazioni"
        description={
          <>
            Ambito: <AmbitoBadge ambito={filtroAmbito} className="align-middle" />
          </>
        }
      />
      <EmptyState icon={Settings} title="Impostazioni in arrivo" description="Categorie, tipi di servizio, notifiche e utenti vengono aggiunti fase per fase." />
    </>
  );
}
