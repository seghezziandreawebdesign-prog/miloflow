import { CalendarDays } from "lucide-react";
import type { Metadata } from "next";

import { AmbitoBadge } from "@/components/ambito-badge";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { getFiltroAmbito } from "@/lib/ambito.server";

export const metadata: Metadata = { title: "Calendario" };

export default async function Page() {
  const filtroAmbito = await getFiltroAmbito();

  return (
    <>
      <PageHeader
        title="Calendario"
        description={
          <>
            Ambito: <AmbitoBadge ambito={filtroAmbito} className="align-middle" />
          </>
        }
      />
      <EmptyState icon={CalendarDays} title="Calendario vuoto" description="Task, eventi, scadenze e rate appariranno qui con la fase 4." />
    </>
  );
}
