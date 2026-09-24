import type { Metadata } from "next";
import { Suspense } from "react";

import { SchedaCliente } from "@/components/clienti/scheda/scheda-cliente";
import { nomeCliente } from "@/lib/clienti";
import { getCliente } from "@/lib/queries/clienti";
import { listServizi } from "@/lib/queries/servizi";
import { createClient } from "@/lib/supabase/server";
import { getUtenteCorrente } from "@/lib/utente.server";

export async function generateMetadata(props: PageProps<"/clienti/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  const { cliente } = await getCliente(id);
  return { title: nomeCliente(cliente) };
}

export default async function ClientePage(props: PageProps<"/clienti/[id]">) {
  const { id } = await props.params;
  const supabase = await createClient();
  const [scheda, utente, tagsRes, servizi, budget] = await Promise.all([
    getCliente(id),
    getUtenteCorrente(),
    supabase.from("clienti").select("tags"),
    listServizi({ clienteId: id }),
    supabase.rpc("puo", { p_sezione: "budget" }),
  ]);
  const tags = [...new Set((tagsRes.data ?? []).flatMap((r) => r.tags))].sort((a, b) => a.localeCompare(b, "it"));

  return (
    <Suspense>
      <SchedaCliente
        scheda={scheda}
        servizi={servizi}
        mostraCosti={budget.data === true}
        tagSuggestions={tags}
        isOwner={utente.ruolo === "owner"}
      />
    </Suspense>
  );
}
