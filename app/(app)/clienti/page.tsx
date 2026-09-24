import type { Metadata } from "next";
import { Suspense } from "react";

import { ClientiView } from "@/components/clienti/clienti-view";
import { PageHeader } from "@/components/page-header";
import { getFiltroAmbito } from "@/lib/ambito.server";
import { listClienti } from "@/lib/queries/clienti";
import { getUtenteCorrente } from "@/lib/utente.server";

export const metadata: Metadata = { title: "Clienti" };

export default async function ClientiPage() {
  const [clienti, filtroAmbito, utente] = await Promise.all([listClienti(), getFiltroAmbito(), getUtenteCorrente()]);
  const tags = [...new Set(clienti.flatMap((c) => c.tags ?? []))].sort((a, b) => a.localeCompare(b, "it"));

  return (
    <>
      <PageHeader
        title="Clienti"
        description={
          filtroAmbito === "personale"
            ? "I clienti fanno sempre parte dell'ambito lavoro."
            : `${clienti.length} ${clienti.length === 1 ? "cliente" : "clienti"}`
        }
      />
      <Suspense>
        <ClientiView clienti={clienti} tags={tags} puoCreare={utente.ruolo === "owner"} />
      </Suspense>
    </>
  );
}
