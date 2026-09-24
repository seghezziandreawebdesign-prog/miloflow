"use client";

import { Check, ChevronsUpDown } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/** Scelta di un elemento da un elenco con ricerca; "" = nessuno. */
export function SceltaPicker({
  opzioni,
  value,
  onChange,
  placeholder,
  nessuno = "Nessuno",
  cerca = "Cerca…",
  id,
  disabled,
  className,
}: {
  opzioni: { id: string; nome: string }[];
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  nessuno?: string;
  cerca?: string;
  id?: string;
  disabled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const scelto = opzioni.find((o) => o.id === value);

  function scegli(nuovo: string) {
    onChange(nuovo);
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            id={id}
            type="button"
            variant="outline"
            disabled={disabled}
            className={cn("w-full justify-between font-normal", !scelto && "text-muted-foreground", className)}
          />
        }
      >
        <span className="truncate">{scelto?.nome ?? placeholder}</span>
        <ChevronsUpDown className="opacity-50" />
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <Command>
          <CommandInput placeholder={cerca} />
          <CommandList>
            <CommandEmpty>Nessun risultato.</CommandEmpty>
            <CommandGroup>
              <CommandItem value="__nessuno" onSelect={() => scegli("")}>
                <span className="text-muted-foreground">{nessuno}</span>
                {!value && <Check className="ml-auto" />}
              </CommandItem>
              {opzioni.map((o) => (
                <CommandItem key={o.id} value={`${o.nome} ${o.id}`} onSelect={() => scegli(o.id)}>
                  <span className="truncate">{o.nome}</span>
                  {o.id === value && <Check className="ml-auto" />}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
