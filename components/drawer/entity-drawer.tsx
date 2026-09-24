"use client";

import { XIcon } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent } from "@/components/ui/dialog";
import { APRI_PARAM, ETICHETTE_ENTITA, parseApri, type RiferimentoEntita } from "@/lib/entita";

import { ClienteDrawer } from "./cliente-drawer";
import { EventoDrawer } from "./evento-drawer";
import { PannelloDescription, PannelloHeader, PannelloTitle } from "./pannello";
import { ProgettoDrawer } from "./progetto-drawer";
import { ServizioDrawer } from "./servizio-drawer";
import { TaskDrawer } from "./task-drawer";

// Pannello unico delle entità: una finestra al centro dello schermo (un
// foglio dal basso su mobile). Si apre da qualsiasi pagina con
// ?apri=<tipo>:<id> e smista al contenuto giusto in base al tipo.
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
    <Dialog open={ref !== null} onOpenChange={(open) => !open && close()}>
      <DialogContent
        showCloseButton={false}
        className="block max-h-[92svh] overflow-y-auto p-0 max-sm:max-h-[94svh] max-sm:pb-0 sm:max-w-2xl"
      >
        {/* Chiusura sempre visibile anche scorrendo il contenuto. */}
        <div className="pointer-events-none sticky top-0 z-10 -mb-11 flex justify-end p-2.5">
          <DialogClose
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                className="pointer-events-auto rounded-full bg-black/6 text-muted-foreground hover:bg-black/10 hover:text-foreground"
              />
            }
          >
            <XIcon />
            <span className="sr-only">Chiudi</span>
          </DialogClose>
        </div>
        {ref && <EntityContent riferimento={ref} />}
      </DialogContent>
    </Dialog>
  );
}

function EntityContent({ riferimento }: { riferimento: RiferimentoEntita }) {
  switch (riferimento.tipo) {
    case "cliente":
      return <ClienteDrawer id={riferimento.id} />;
    case "servizio":
      return <ServizioDrawer id={riferimento.id} />;
    case "task":
      return <TaskDrawer key={riferimento.id} id={riferimento.id} />;
    case "progetto":
      return <ProgettoDrawer key={riferimento.id} id={riferimento.id} />;
    case "evento":
      return <EventoDrawer key={riferimento.id} id={riferimento.id} />;
    // Gli altri contenuti arrivano con la fase 5.
    case "movimento":
    case "debito":
      return <Segnaposto riferimento={riferimento} />;
  }
}

function Segnaposto({ riferimento }: { riferimento: RiferimentoEntita }) {
  return (
    <PannelloHeader className="pr-12">
      <PannelloTitle>{ETICHETTE_ENTITA[riferimento.tipo]}</PannelloTitle>
      <PannelloDescription>
        Il dettaglio di questo elemento sarà disponibile nelle prossime fasi.
      </PannelloDescription>
      <p className="mt-4 font-mono text-xs break-all text-muted-foreground">{riferimento.id}</p>
    </PannelloHeader>
  );
}
