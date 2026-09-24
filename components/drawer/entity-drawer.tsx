"use client";

import { XIcon } from "lucide-react";
import dynamic from "next/dynamic";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { APRI_PARAM, parseApri, type RiferimentoEntita } from "@/lib/entita";
import { cn } from "@/lib/utils";

// I contenuti si scaricano solo alla prima apertura del pannello: così le
// pagine non portano con sé editor, grafici e il resto degli otto pannelli.
const caricamento = {
  loading: () => (
    <div className="space-y-3 p-6 pt-14">
      <Skeleton className="h-7 w-2/5" />
      <Skeleton className="h-4 w-3/5" />
      <Skeleton className="h-40 w-full" />
    </div>
  ),
};
const ClienteDrawer = dynamic(() => import("./cliente-drawer").then((m) => m.ClienteDrawer), caricamento);
const DebitoDrawer = dynamic(() => import("./debito-drawer").then((m) => m.DebitoDrawer), caricamento);
const EventoDrawer = dynamic(() => import("./evento-drawer").then((m) => m.EventoDrawer), caricamento);
const MovimentoDrawer = dynamic(() => import("./movimento-drawer").then((m) => m.MovimentoDrawer), caricamento);
const ProgettoDrawer = dynamic(() => import("./progetto-drawer").then((m) => m.ProgettoDrawer), caricamento);
const SalvadanaioDrawer = dynamic(() => import("./salvadanaio-drawer").then((m) => m.SalvadanaioDrawer), caricamento);
const ServizioDrawer = dynamic(() => import("./servizio-drawer").then((m) => m.ServizioDrawer), caricamento);
const TaskDrawer = dynamic(() => import("./task-drawer").then((m) => m.TaskDrawer), caricamento);

// Pannello unico delle entità: una finestra al centro dello schermo (un
// foglio dal basso su mobile). Si apre da qualsiasi pagina con
// ?apri=<tipo>:<id> e smista al contenuto giusto in base al tipo.
export function EntityDrawer() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const ref = parseApri(searchParams.get(APRI_PARAM));
  // Il tipo resta quello dell'ultima entità durante l'animazione di chiusura,
  // così la finestra non cambia misura mentre si chiude.
  const [tipo, setTipo] = useState(ref?.tipo);
  if (ref && ref.tipo !== tipo) setTipo(ref.tipo);

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
        className={cn(
          "block max-h-[92svh] overflow-y-auto p-0 max-sm:max-h-[94svh] max-sm:pb-0",
          // La task ha una descrizione lunga: finestra quasi a tutto schermo.
          tipo === "task" ? "sm:h-[90svh] sm:max-h-[90svh] sm:max-w-[min(1200px,95vw)]" : "sm:max-w-2xl",
        )}
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
    case "movimento":
      return <MovimentoDrawer key={riferimento.id} id={riferimento.id} />;
    case "debito":
      return <DebitoDrawer key={riferimento.id} id={riferimento.id} />;
    case "salvadanaio":
      return <SalvadanaioDrawer key={riferimento.id} id={riferimento.id} />;
  }
}
