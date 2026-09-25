"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useCallback, useState } from "react";

import { AggiornaSchedaProvider, SchedaClienteContenuto, type TabCliente } from "@/components/clienti/scheda/scheda-cliente";
import { PannelloDescription, PannelloHeader, PannelloTitle } from "@/components/drawer/pannello";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { nomeCliente } from "@/lib/clienti";
import { caricaSchedaCliente, caricaServizi } from "@/lib/queries/cliente-scheda";
import { createClient } from "@/lib/supabase/client";

async function fetchScheda(id: string) {
  const supabase = createClient();
  const [scheda, servizi, budget, owner, tags] = await Promise.all([
    caricaSchedaCliente(supabase, id),
    caricaServizi(supabase, { clienteId: id }),
    supabase.rpc("puo", { p_sezione: "budget" }),
    supabase.rpc("is_owner"),
    supabase.from("clienti").select("tags"),
  ]);
  if (!scheda) return null;
  const tagSuggestions = [...new Set((tags.data ?? []).flatMap((r) => r.tags))].sort((a, b) => a.localeCompare(b, "it"));
  return {
    scheda,
    servizi,
    mostraCosti: budget.data === true,
    isOwner: owner.data === true,
    tagSuggestions,
  };
}

/** Scheda completa del cliente nel pannello grande; la pagina resta per i link diretti. */
export function ClienteDrawer({ id }: { id: string }) {
  const { data, isPending, isError } = useQuery({ queryKey: ["scheda-cliente", id], queryFn: () => fetchScheda(id) });
  const [tab, setTab] = useState<TabCliente>("panoramica");
  const queryClient = useQueryClient();
  const aggiorna = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["scheda-cliente", id] });
  }, [queryClient, id]);

  if (isPending) {
    return (
      <div className="space-y-3 p-4 pt-12 sm:p-6 sm:pt-12">
        <Skeleton className="size-16 rounded-xl" />
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (isError || !data) {
    return (
      <PannelloHeader>
        <PannelloTitle>Cliente non trovato</PannelloTitle>
        <PannelloDescription>Potrebbe essere stato eliminato, oppure non hai accesso.</PannelloDescription>
      </PannelloHeader>
    );
  }

  return (
    <div className="p-4 pt-11 sm:p-6 sm:pt-11">
      <PannelloTitle className="sr-only">{nomeCliente(data.scheda.cliente)}</PannelloTitle>
      <div className="mb-3 flex justify-start">
        <Link href={`/clienti/${id}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
          Apri come pagina
          <ArrowRight />
        </Link>
      </div>
      <AggiornaSchedaProvider value={aggiorna}>
        <SchedaClienteContenuto
          scheda={data.scheda}
          servizi={data.servizi}
          mostraCosti={data.mostraCosti}
          tagSuggestions={data.tagSuggestions}
          isOwner={data.isOwner}
          tab={tab}
          onTabChange={setTab}
        />
      </AggiornaSchedaProvider>
    </div>
  );
}
