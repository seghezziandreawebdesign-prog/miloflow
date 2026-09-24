"use client";

import { XIcon } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent } from "@/components/ui/dialog";
import { APRI_PARAM, parseApri, type RiferimentoEntita } from "@/lib/entita";
import { cn } from "@/lib/utils";

import { ClienteDrawer } from "./cliente-drawer";
import { DebitoDrawer } from "./debito-drawer";
import { EventoDrawer } from "./evento-drawer";
import { MovimentoDrawer } from "./movimento-drawer";
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
  }
}
