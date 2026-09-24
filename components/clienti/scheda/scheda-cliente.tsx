"use client";

import { ArrowLeft, CalendarDays } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

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
type Tab = (typeof TABS)[number]["value"];

export function SchedaCliente({
  scheda,
  servizi,
  mostraCosti,
  tagSuggestions,
  isOwner,
}: {
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

      <IntestazioneCliente cliente={scheda.cliente} tagSuggestions={tagSuggestions} isOwner={isOwner} />

      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
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
          <div className="mt-4 rounded-xl bg-card p-4 ring-1 ring-foreground/10 lg:max-w-[calc(100%-23rem)]">
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
