"use client";

import { FileSignature, Plus } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { ClienteLogo } from "@/components/clienti/cliente-logo";
import { useApriEntita } from "@/components/drawer/use-apri-entita";
import { EmptyState } from "@/components/empty-state";
import { BarraFiltri, CampoRicerca } from "@/components/filtri/barra-filtri";
import { FiltroChip } from "@/components/filtri/filtro-chip";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/dates/format";
import type { ContrattoLista } from "@/lib/queries/contratti";
import { contrattoVuoto } from "@/lib/schemas/contratti";

import { ContrattoDialog } from "./contratto-dialog";
import { StatoContrattoBadge } from "./stato-badge";

const FILTRI_STATO = [
  { value: "attivo", label: "Attivi" },
  { value: "concluso", label: "Conclusi" },
  { value: "tutti", label: "Tutti" },
];

export function ContrattiView({ contratti }: { contratti: ContrattoLista[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const apri = useApriEntita();

  const [query, setQuery] = useState("");
  const [stato, setStato] = useState("attivo");
  const creaAperto = searchParams.get("nuovo") === "1";

  function setCreaAperto(open: boolean) {
    const params = new URLSearchParams(searchParams.toString());
    if (open) params.set("nuovo", "1");
    else params.delete("nuovo");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  const q = query.trim().toLowerCase();
  const filtrati = contratti.filter((c) => {
    if (stato !== "tutti" && c.stato !== stato) return false;
    if (q && ![c.titolo, c.cliente?.nome, ...c.righe.map((r) => r.nome)].some((v) => v?.toLowerCase().includes(q))) {
      return false;
    }
    return true;
  });

  const dialog = (
    <ContrattoDialog
      open={creaAperto}
      onOpenChange={setCreaAperto}
      defaultValues={contrattoVuoto()}
      onSaved={(id) => apri({ tipo: "contratto", id })}
    />
  );

  if (contratti.length === 0) {
    return (
      <>
        <EmptyState
          icon={FileSignature}
          title="Nessun contratto"
          description="Scegli un cliente, aggiungi i suoi servizi con il prezzo che paga e ottieni il totale."
          action={
            <Button onClick={() => setCreaAperto(true)}>
              <Plus />
              Crea il primo contratto
            </Button>
          }
        />
        {dialog}
      </>
    );
  }

  return (
    <div className="space-y-5">
      <BarraFiltri
        ricerca={
          <CampoRicerca value={query} onChange={setQuery} placeholder="Cerca per cliente, titolo, servizio…" label="Cerca contratti" />
        }
        destra={
          <Button className="hidden sm:inline-flex" onClick={() => setCreaAperto(true)}>
            <Plus />
            Nuovo contratto
          </Button>
        }
        azzera={
          stato !== "attivo" || query !== ""
            ? () => {
                setStato("attivo");
                setQuery("");
              }
            : null
        }
      >
        <FiltroChip label="Stato" value={stato} onChange={setStato} opzioni={FILTRI_STATO} />
      </BarraFiltri>

      {filtrati.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">Nessun contratto corrisponde ai filtri.</p>
      ) : (
        <ul className="divide-y divide-black/5 overflow-hidden rounded-xl bg-card shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-black/8">
          {filtrati.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => apri({ tipo: "contratto", id: c.id })}
                className="grid w-full cursor-pointer grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 px-4 py-3 text-left outline-none hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  {c.cliente && (
                    <ClienteLogo
                      nome={c.cliente.nome}
                      colore={c.cliente.colore}
                      logoUrl={c.cliente.logo_url}
                      sito={c.cliente.sito}
                      size="sm"
                    />
                  )}
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {c.cliente?.nome ?? "Cliente"}
                      {c.titolo && <span className="font-normal text-muted-foreground"> · {c.titolo}</span>}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {c.righe.length === 1 ? "1 servizio" : `${c.righe.length} servizi`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right text-sm">
                    <p className="font-medium tabular-nums">{formatCurrency(c.totale_annuo)} l&apos;anno</p>
                    {c.una_tantum > 0 && (
                      <p className="text-xs text-muted-foreground">+ {formatCurrency(c.una_tantum)} una tantum</p>
                    )}
                  </div>
                  <StatoContrattoBadge stato={c.stato} />
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
      {dialog}
    </div>
  );
}
