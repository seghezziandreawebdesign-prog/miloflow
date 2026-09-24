"use client";

import { Building2, CalendarDays, FolderKanban, ListChecks, Loader2, RefreshCw, type LucideIcon } from "lucide-react";
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
import type { FiltroAmbito } from "@/lib/ambito";
import { AZIONI_CREAZIONE } from "@/lib/creazione-rapida";
import { APRI_PARAM, formatApri, type RiferimentoEntita, type TipoEntita } from "@/lib/entita";
import { NAVIGAZIONE } from "@/lib/navigazione";
import { cn } from "@/lib/utils";

import { useRicercaEntita, type RisultatoRicerca } from "./ricerca-entita";
import { useCreazioneRapida } from "./use-creazione-rapida";

const GRUPPI: { tipo: TipoEntita; titolo: string; icona: LucideIcon }[] = [
  { tipo: "task", titolo: "Task", icona: ListChecks },
  { tipo: "progetto", titolo: "Progetti", icona: FolderKanban },
  { tipo: "cliente", titolo: "Clienti", icona: Building2 },
  { tipo: "servizio", titolo: "Servizi", icona: RefreshCw },
  { tipo: "evento", titolo: "Eventi", icona: CalendarDays },
];

type PaletteContext = { open: () => void };

const Context = createContext<PaletteContext | null>(null);

export function useCommandPalette() {
  const ctx = useContext(Context);
  if (!ctx) throw new Error("useCommandPalette fuori da CommandPaletteProvider");
  return ctx;
}

// Palette ⌘K / Ctrl+K: cerca tra task, progetti, clienti, servizi ed eventi
// (rispettando lo switch di ambito), più navigazione e comandi rapidi.
export function CommandPaletteProvider({
  filtroAmbito,
  children,
}: {
  filtroAmbito: FiltroAmbito;
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [testo, setTesto] = useState("");
  const router = useRouter();
  const avviaCreazione = useCreazioneRapida();
  const ricerca = useRicercaEntita(isOpen ? testo : "", filtroAmbito);
  const risultati = testo.trim().length >= 2 ? (ricerca.data ?? []) : [];

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
    setTesto("");
    action();
  }

  // L'URL si legge al momento del click: la palette vive nel layout.
  function apri(ref: RiferimentoEntita) {
    const params = new URLSearchParams(window.location.search);
    params.set(APRI_PARAM, formatApri(ref));
    router.push(`${window.location.pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <Context.Provider value={{ open: () => setIsOpen(true) }}>
      {children}
      <CommandDialog
        open={isOpen}
        onOpenChange={(open) => {
          setIsOpen(open);
          if (!open) setTesto("");
        }}
        title="Cerca e comandi"
        description="Cerca task, progetti, clienti, servizi ed eventi, oppure avvia un comando"
      >
        <Command>
          <CommandInput
            placeholder="Cerca task, clienti, servizi… o un comando"
            value={testo}
            onValueChange={setTesto}
          />
          <CommandList>
            <CommandEmpty>
              {ricerca.isFetching ? (
                <Loader2 className="mx-auto size-4 animate-spin text-muted-foreground" />
              ) : (
                "Nessun risultato."
              )}
            </CommandEmpty>
            {GRUPPI.map(({ tipo, titolo, icona }) => {
              const voci = risultati.filter((r) => r.tipo === tipo);
              if (voci.length === 0) return null;
              return (
                <CommandGroup key={tipo} heading={titolo}>
                  {voci.map((r) => (
                    <VoceRisultato key={r.id} risultato={r} icona={icona} testo={testo} onSelect={() => run(() => apri(r))} />
                  ))}
                </CommandGroup>
              );
            })}
            {risultati.length > 0 && <CommandSeparator />}
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

function VoceRisultato({
  risultato,
  icona: Icona,
  testo,
  onSelect,
}: {
  risultato: RisultatoRicerca;
  icona: LucideIcon;
  testo: string;
  onSelect: () => void;
}) {
  return (
    <CommandItem
      // I risultati sono già filtrati dal database: il testo cercato tra le
      // parole chiave evita che il filtro della palette li nasconda.
      value={`${risultato.tipo}:${risultato.id}`}
      keywords={[testo, risultato.titolo]}
      onSelect={onSelect}
      className={cn(risultato.secondario && "text-muted-foreground")}
    >
      <Icona />
      <span className={cn("truncate", risultato.secondario && risultato.tipo === "task" && "line-through")}>
        {risultato.titolo}
      </span>
      {risultato.dettaglio && (
        <span className="ml-auto truncate pl-3 text-xs text-muted-foreground">{risultato.dettaglio}</span>
      )}
    </CommandItem>
  );
}
