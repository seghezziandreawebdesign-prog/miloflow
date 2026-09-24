"use client";

import { useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState } from "react";

import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { AZIONI_CREAZIONE } from "@/lib/creazione-rapida";
import { NAVIGAZIONE } from "@/lib/navigazione";

import { useCreazioneRapida } from "./use-creazione-rapida";

type PaletteContext = { open: () => void };

const Context = createContext<PaletteContext | null>(null);

export function useCommandPalette() {
  const ctx = useContext(Context);
  if (!ctx) throw new Error("useCommandPalette fuori da CommandPaletteProvider");
  return ctx;
}

// Palette ⌘K / Ctrl+K. In fase 1 solo navigazione e comandi rapidi;
// la ricerca tra le entità arriva con la fase 3.
export function CommandPaletteProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();
  const avviaCreazione = useCreazioneRapida();

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setIsOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function run(action: () => void) {
    setIsOpen(false);
    action();
  }

  return (
    <Context.Provider value={{ open: () => setIsOpen(true) }}>
      {children}
      <CommandDialog
        open={isOpen}
        onOpenChange={setIsOpen}
        title="Cerca e comandi"
        description="Vai a una sezione o avvia un comando"
      >
        <Command>
          <CommandInput placeholder="Cerca una sezione o un comando…" />
          <CommandList>
            <CommandEmpty>Nessun risultato.</CommandEmpty>
            <CommandGroup heading="Vai a">
              {NAVIGAZIONE.map(({ href, label, icon: Icon }) => (
                <CommandItem key={href} value={`vai ${label}`} onSelect={() => run(() => router.push(href))}>
                  <Icon />
                  {label}
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup heading="Crea">
              {AZIONI_CREAZIONE.map((azione) => (
                <CommandItem
                  key={azione.id}
                  value={azione.label}
                  onSelect={() => run(() => avviaCreazione(azione))}
                >
                  <azione.icon />
                  {azione.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </CommandDialog>
    </Context.Provider>
  );
}
