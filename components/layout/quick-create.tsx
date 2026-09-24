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

export function QuickCreate() {
  const avvia = useCreazioneRapida();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button size="icon" aria-label="Crea nuovo" />}>
        <Plus />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        {AZIONI_CREAZIONE.map((azione) => (
          <DropdownMenuItem key={azione.id} onClick={() => avvia(azione)}>
            <azione.icon />
            {azione.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
