import type { Metadata } from "next";
import { Suspense } from "react";

import { CalendarioView } from "@/components/calendario/calendario-view";
import { getFiltroAmbito } from "@/lib/ambito.server";
import { leggiImpostazioniCalendario } from "@/lib/queries/calendario";

export const metadata: Metadata = { title: "Calendario" };

export default async function Page() {
  const [filtroAmbito, impostazioni] = await Promise.all([getFiltroAmbito(), leggiImpostazioniCalendario()]);

  return (
    <Suspense>
      <CalendarioView filtroAmbito={filtroAmbito} impostazioni={impostazioni} />
    </Suspense>
  );
}
