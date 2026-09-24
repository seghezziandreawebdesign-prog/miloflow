"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { APRI_PARAM, ETICHETTE_ENTITA, parseApri, type RiferimentoEntita } from "@/lib/entita";

import { ClienteDrawer } from "./cliente-drawer";
import { ServizioDrawer } from "./servizio-drawer";

// Pannello laterale unico. Si apre da qualsiasi pagina con ?apri=<tipo>:<id>
// e smista al contenuto giusto in base al tipo.
export function EntityDrawer() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const ref = parseApri(searchParams.get(APRI_PARAM));

  function close() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete(APRI_PARAM);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  return (
    <Sheet open={ref !== null} onOpenChange={(open) => !open && close()}>
      <SheetContent side="right" className="w-full sm:max-w-xl">
        {ref && <EntityContent riferimento={ref} />}
      </SheetContent>
    </Sheet>
  );
}

function EntityContent({ riferimento }: { riferimento: RiferimentoEntita }) {
  switch (riferimento.tipo) {
    case "cliente":
      return <ClienteDrawer id={riferimento.id} />;
    case "servizio":
      return <ServizioDrawer id={riferimento.id} />;
    // Gli altri contenuti arrivano con le fasi successive.
    case "task":
    case "progetto":
    case "evento":
    case "movimento":
    case "debito":
      return <Segnaposto riferimento={riferimento} />;
  }
}

function Segnaposto({ riferimento }: { riferimento: RiferimentoEntita }) {
  return (
    <SheetHeader className="pr-12">
      <SheetTitle>{ETICHETTE_ENTITA[riferimento.tipo]}</SheetTitle>
      <SheetDescription>
        Il dettaglio di questo elemento sarà disponibile nelle prossime fasi.
      </SheetDescription>
      <p className="mt-4 font-mono text-xs break-all text-muted-foreground">{riferimento.id}</p>
    </SheetHeader>
  );
}
