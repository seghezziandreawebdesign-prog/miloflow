import type { Metadata } from "next";
import { Suspense } from "react";

import { ContrattiView } from "@/components/contratti/contratti-view";
import { PageHeader } from "@/components/page-header";
import { caricaContratti } from "@/lib/queries/contratti";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Contratti" };

export default async function ContrattiPage() {
  const supabase = await createClient();
  const contratti = await caricaContratti(supabase);

  return (
    <>
      <PageHeader
        title="Contratti"
        description="Che cosa paga ogni cliente: i servizi attivi con i prezzi e il totale."
      />
      <Suspense>
        <ContrattiView contratti={contratti} />
      </Suspense>
    </>
  );
}
