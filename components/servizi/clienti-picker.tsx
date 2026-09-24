"use client";

import { Plus, X } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/** Scelta multipla dei clienti collegati a un servizio. */
export function ClientiPicker({
  opzioni,
  value,
  onChange,
  id,
}: {
  opzioni: { id: string; nome: string }[];
  value: string[];
  onChange: (value: string[]) => void;
  id?: string;
}) {
  const [open, setOpen] = useState(false);
  const nome = new Map(opzioni.map((o) => [o.id, o.nome]));

  function toggle(clienteId: string) {
    onChange(value.includes(clienteId) ? value.filter((v) => v !== clienteId) : [...value, clienteId]);
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {value.map((clienteId) => (
        <span key={clienteId} className="inline-flex items-center gap-1 rounded-full bg-muted py-0.5 pr-1 pl-2.5 text-xs">
          {nome.get(clienteId) ?? "Cliente"}
          <button
            type="button"
            onClick={() => toggle(clienteId)}
            className="rounded-full p-0.5 hover:bg-foreground/10"
            aria-label={`Scollega ${nome.get(clienteId) ?? "cliente"}`}
          >
            <X className="size-3" />
          </button>
        </span>
      ))}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger render={<Button id={id} type="button" variant="outline" size="sm" />}>
          <Plus />
          {value.length === 0 ? "Collega clienti" : "Aggiungi"}
        </PopoverTrigger>
        <PopoverContent className="w-72 p-0" align="start">
          <Command>
            <CommandInput placeholder="Cerca un cliente…" />
            <CommandList>
              <CommandEmpty>Nessun cliente trovato.</CommandEmpty>
              <CommandGroup>
                {opzioni.map((o) => (
                  <CommandItem
                    key={o.id}
                    value={`${o.nome} ${o.id}`}
                    data-checked={value.includes(o.id)}
                    onSelect={() => toggle(o.id)}
                  >
                    {o.nome}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
