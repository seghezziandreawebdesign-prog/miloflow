"use client";

import { ArrowLeft, CalendarDays } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createContext, useCallback, useContext } from "react";

import { EmptyState } from "@/components/empty-state";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CredenzialiSection } from "@/components/credenziali/credenziali-section";
import type { SchedaCliente as SchedaClienteData } from "@/lib/queries/clienti";
import type { ServizioLista } from "@/lib/queries/servizi";

import { DiarioCliente } from "./diario-cliente";
import { IntestazioneCliente } from "./intestazione-cliente";
import { PanoramicaCliente } from "./panoramica-cliente";
import { ProgettiTaskCliente } from "./progetti-task-cliente";
import { ServiziCliente } from "./servizi-cliente";

const TABS = [
  { value: "panoramica", label: "Panoramica" },
  { value: "servizi", label: "Servizi" },
  { value: "progetti", label: "Progetti e task" },
  { value: "eventi", label: "Eventi" },
  { value: "diario", label: "Diario" },
] as const;
export type TabCliente = (typeof TABS)[number]["value"];
type Tab = TabCliente;

// Nella pagina i dati arrivano dai Server Components e si aggiornano da soli
// con le revalidate delle action; nel pannello arrivano da React Query e vanno
// invalidati a mano dopo ogni modifica. I componenti della scheda chiamano
// questo hook dopo un salvataggio riuscito: fuori dal pannello è un no-op.
const AggiornaSchedaContext = createContext<(() => void) | null>(null);

export const AggiornaSchedaProvider = AggiornaSchedaContext.Provider;

export function useAggiornaScheda() {
  const aggiorna = useContext(AggiornaSchedaContext);
  return useCallback(() => aggiorna?.(), [aggiorna]);
}

/** Pagina /clienti/[id]: la scheda con la tab nell'URL (?tab=). */
export function SchedaCliente(props: {
  scheda: SchedaClienteData;
  servizi: ServizioLista[];
  mostraCosti: boolean;
  tagSuggestions: string[];
  isOwner: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const tab: Tab = TABS.some((t) => t.value === tabParam) ? (tabParam as Tab) : "panoramica";

  function setTab(value: Tab) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "panoramica") params.delete("tab");
    else params.set("tab", value);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  return (
    <div className="space-y-6">
      <Link href="/clienti" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" />
        Clienti
      </Link>
      <SchedaClienteContenuto {...props} tab={tab} onTabChange={setTab} />
    </div>
  );
}

/** Corpo della scheda, con la tab controllata: lo usano la pagina e il pannello. */
export function SchedaClienteContenuto({
  scheda,
  servizi,
  mostraCosti,
  tagSuggestions,
  isOwner,
  tab,
  onTabChange,
}: {
  scheda: SchedaClienteData;
  servizi: ServizioLista[];
  mostraCosti: boolean;
  tagSuggestions: string[];
  isOwner: boolean;
  tab: Tab;
  onTabChange: (tab: Tab) => void;
}) {
  return (
    <div className="space-y-6">
      <IntestazioneCliente cliente={scheda.cliente} tagSuggestions={tagSuggestions} isOwner={isOwner} />

      <Tabs value={tab} onValueChange={(v) => onTabChange(v as Tab)}>
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <TabsList variant="line" className="w-max">
            {TABS.map((t) => (
              <TabsTrigger key={t.value} value={t.value}>
                {t.label}
                {t.value === "servizi" && servizi.length > 0 && (
                  <span className="ml-1 rounded-full bg-muted px-1.5 text-xs tabular-nums">{servizi.length}</span>
                )}
                {t.value === "diario" && scheda.diario.length > 0 && (
                  <span className="ml-1 rounded-full bg-muted px-1.5 text-xs tabular-nums">{scheda.diario.length}</span>
                )}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value="panoramica" className="pt-4">
          <PanoramicaCliente scheda={scheda} />
          <div className="mt-4 rounded-xl bg-card p-4 ring-1 ring-black/8 lg:max-w-[calc(100%-23rem)]">
            <CredenzialiSection proprietario={{ cliente_id: scheda.cliente.id }} />
          </div>
        </TabsContent>
        <TabsContent value="servizi" className="pt-4">
          <ServiziCliente clienteId={scheda.cliente.id} servizi={servizi} mostraCosti={mostraCosti} />
        </TabsContent>
        <TabsContent value="progetti" className="pt-4">
          <ProgettiTaskCliente clienteId={scheda.cliente.id} />
        </TabsContent>
        <TabsContent value="eventi" className="pt-4">
          <EmptyState
            icon={CalendarDays}
            title="Nessun evento"
            description="Gli appuntamenti passati e futuri con questo cliente arrivano con la fase 4."
          />
        </TabsContent>
        <TabsContent value="diario" className="pt-4">
          <DiarioCliente clienteId={scheda.cliente.id} note={scheda.diario} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
