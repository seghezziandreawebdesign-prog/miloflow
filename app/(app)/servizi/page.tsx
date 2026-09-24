import type { Metadata } from "next";
import { Suspense } from "react";

import { AmbitoBadge } from "@/components/ambito-badge";
import { PageHeader } from "@/components/page-header";
import { ServiziView } from "@/components/servizi/servizi-view";
import { getFiltroAmbito } from "@/lib/ambito.server";
import { listServizi } from "@/lib/queries/servizi";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Servizi & Scadenze" };

export default async function ServiziPage() {
  const filtroAmbito = await getFiltroAmbito();
  const supabase = await createClient();
  const [servizi, budget] = await Promise.all([
    listServizi({ ambito: filtroAmbito }),
    supabase.rpc("puo", { p_sezione: "budget" }),
  ]);

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
      <Suspense>
        <ServiziView servizi={servizi} filtroAmbito={filtroAmbito} mostraCosti={budget.data === true} />
      </Suspense>
    </>
  );
}
