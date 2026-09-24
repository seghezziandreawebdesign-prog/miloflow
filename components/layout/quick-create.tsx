"use client";

import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AZIONI_CREAZIONE } from "@/lib/creazione-rapida";

import { useCreazioneRapida } from "./use-creazione-rapida";

function VociCreazione() {
  const avvia = useCreazioneRapida();
  return (
    <>
      {AZIONI_CREAZIONE.map((azione) => (
        <DropdownMenuItem key={azione.id} onClick={() => avvia(azione)}>
          <azione.icon />
          {azione.label}
        </DropdownMenuItem>
      ))}
    </>
  );
}

/** Pulsante + nell'header (desktop). */
export function QuickCreate() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button size="icon" className="rounded-full" aria-label="Crea nuovo" />}>
        <Plus />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <VociCreazione />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Pulsante + fisso in basso a destra (mobile), con lo stesso menu. */
export function QuickCreateFab() {
  return (
    <div className="fixed right-4 bottom-[max(1.25rem,env(safe-area-inset-bottom))] z-30 lg:hidden">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              size="icon-lg"
              className="size-14 rounded-full shadow-[0_8px_24px_rgba(0,113,227,0.4)] active:scale-95 [&_svg]:size-6"
              aria-label="Crea nuovo"
            />
          }
        >
          <Plus />
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="end" sideOffset={10} className="w-56 [&_[data-slot=dropdown-menu-item]]:py-2.5 [&_[data-slot=dropdown-menu-item]]:text-[15px]">
          <VociCreazione />
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
