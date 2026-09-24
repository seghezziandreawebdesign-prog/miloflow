import { Sun } from "lucide-react";
import type { Metadata } from "next";

import { AmbitoBadge } from "@/components/ambito-badge";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { getFiltroAmbito } from "@/lib/ambito.server";
import { capitalize, formatLongDate, todayISO } from "@/lib/dates/format";

export const metadata: Metadata = { title: "Oggi" };

export default async function Page() {
  const filtroAmbito = await getFiltroAmbito();

  return (
    <>
      <PageHeader
        title="Oggi"
        description={
          <>
            {capitalize(formatLongDate(todayISO()))} · Ambito: <AmbitoBadge ambito={filtroAmbito} className="align-middle" />
          </>
        }
      />
      <EmptyState icon={Sun} title="Niente in programma" description="Qui compariranno task, eventi, scadenze e spese di oggi." />
    </>
  );
}
