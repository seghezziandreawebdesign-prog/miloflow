"use client";

import { useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Building2, CalendarDays, Flag, FolderKanban, Loader2, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { Input } from "@/components/ui/input";
import { createTask } from "@/lib/actions/task";
import { formatGiornoRelativo, todayISO } from "@/lib/dates/format";
import {
  inserisciRiferimento,
  parseTaskRapida,
  riferimentoInScrittura,
  suggerisciRiferimenti,
  type RiferimentoRapido,
  type TaskRapida,
} from "@/lib/parsing/task-rapida";
import { taskDaRapida, type DefaultTask, type TaskFormValues } from "@/lib/schemas/task";
import { priorita } from "@/lib/task";
import { cn } from "@/lib/utils";

import { invalidaTask, useOpzioniTask } from "./dati";

export type { DefaultTask };

/** Stato e salvataggio dell'aggiunta rapida, riusato dal campo in lista e dal dialog. */
export function useAggiuntaRapida({
  defaults,
  onCreated,
}: {
  defaults: DefaultTask;
  onCreated?: (id: string) => void;
}) {
  const { data: opzioni } = useOpzioniTask();
  const queryClient = useQueryClient();
  const router = useRouter();
  const [testo, setTesto] = useState(defaults.titolo ?? "");
  const [pending, startTransition] = useTransition();
  const riferimenti = useMemo(() => opzioni?.riferimenti ?? [], [opzioni]);
  const parsed = useMemo(() => parseTaskRapida(testo, { oggi: todayISO(), riferimenti }), [testo, riferimenti]);

  function salva(dettagli?: Partial<TaskFormValues>, { chiudi = true }: { chiudi?: boolean } = {}) {
    if (!parsed.titolo) {
      toast.error("Scrivi il titolo della task");
      return;
    }
    const valori = taskDaRapida(parsed, defaults, dettagli);
    startTransition(async () => {
      const result = await createTask(valori);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Task creata: ${valori.titolo}`);
      setTesto("");
      invalidaTask(queryClient);
      router.refresh();
      if (chiudi) onCreated?.(result.data.id);
    });
  }

  return { testo, setTesto, parsed, riferimenti, salva, pending };
}

/**
 * Campo di testo con autocompletamento dei #riferimenti e anteprima di
 * quanto riconosciuto. Invio salva (se non c'è un suggerimento aperto).
 */
export function CampoAggiuntaRapida({
  stato,
  onInvio,
  placeholder = "Aggiungi una task: «Chiamare fornitore domani #cliente !alta»",
  autoFocus,
  id,
  className,
}: {
  stato: ReturnType<typeof useAggiuntaRapida>;
  onInvio: () => void;
  placeholder?: string;
  autoFocus?: boolean;
  id?: string;
  className?: string;
}) {
  const { testo, setTesto, parsed, riferimenti, pending } = stato;
  const inputRef = useRef<HTMLInputElement>(null);
  const [cursore, setCursore] = useState(0);
  const [attivo, setAttivo] = useState(0);
  const [chiusi, setChiusi] = useState(false);

  const inScrittura = riferimentoInScrittura(testo, cursore);
  const suggerimenti = inScrittura && !chiusi ? suggerisciRiferimenti(inScrittura.query, riferimenti) : [];
  const aperto = suggerimenti.length > 0;

  function scegli(r: RiferimentoRapido) {
    if (!inScrittura) return;
    const nuovo = inserisciRiferimento(testo, inScrittura, r);
    setTesto(nuovo.testo);
    setCursore(nuovo.cursore);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(nuovo.cursore, nuovo.cursore);
    });
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (aperto) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setAttivo((i) => (i + 1) % suggerimenti.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setAttivo((i) => (i - 1 + suggerimenti.length) % suggerimenti.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        scegli(suggerimenti[Math.min(attivo, suggerimenti.length - 1)]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        setChiusi(true);
        return;
      }
    }
    if (e.key === "Enter" && !e.nativeEvent.isComposing) {
      e.preventDefault();
      onInvio();
    }
  }

  return (
    <div className={cn("relative", className)}>
      <div className="relative">
        <Plus className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={inputRef}
          id={id}
          value={testo}
          autoFocus={autoFocus}
          placeholder={placeholder}
          aria-label="Nuova task"
          aria-autocomplete="list"
          aria-expanded={aperto}
          disabled={pending}
          className="pr-8 pl-8"
          onChange={(e) => {
            setTesto(e.target.value);
            setCursore(e.target.selectionStart ?? e.target.value.length);
            setAttivo(0);
            setChiusi(false);
          }}
          onSelect={(e) => setCursore(e.currentTarget.selectionStart ?? 0)}
          onKeyDown={onKeyDown}
          onBlur={() => setTimeout(() => setChiusi(true), 150)}
          onFocus={() => setChiusi(false)}
        />
        {pending && (
          <Loader2 className="absolute top-1/2 right-2.5 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>

      {aperto && (
        <ul
          role="listbox"
          className="absolute inset-x-0 top-full z-50 mt-1 max-h-64 overflow-auto rounded-lg border bg-popover p-1 text-sm shadow-md"
        >
          {suggerimenti.map((r, i) => (
            <li
              key={`${r.tipo}:${r.id}`}
              role="option"
              aria-selected={i === attivo}
              onMouseDown={(e) => {
                e.preventDefault();
                scegli(r);
              }}
              onMouseEnter={() => setAttivo(i)}
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5",
                i === attivo && "bg-accent text-accent-foreground",
              )}
            >
              {r.tipo === "progetto" ? (
                <FolderKanban className="size-4 text-muted-foreground" />
              ) : (
                <Building2 className="size-4 text-muted-foreground" />
              )}
              <span className="truncate">{r.nome}</span>
              <span className="ml-auto text-xs text-muted-foreground">{r.tipo === "progetto" ? "Progetto" : "Cliente"}</span>
            </li>
          ))}
        </ul>
      )}

      <AnteprimaRiconosciuti parsed={parsed} />
    </div>
  );
}

/** Chip con i valori riconosciuti nel testo, prima di salvare. */
export function AnteprimaRiconosciuti({ parsed }: { parsed: TaskRapida }) {
  const oggi = todayISO();
  const p = priorita(parsed.priorita);
  const chip = "inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5";
  const voci: React.ReactNode[] = [];
  if (parsed.dataPianificata) {
    voci.push(
      <span key="d" className={chip}>
        <CalendarDays className="size-3" />
        {formatGiornoRelativo(parsed.dataPianificata, oggi)}
      </span>,
    );
  }
  if (parsed.scadenza) {
    voci.push(
      <span key="s" className={chip}>
        <Flag className="size-3" />
        entro {formatGiornoRelativo(parsed.scadenza, oggi).toLowerCase()}
      </span>,
    );
  }
  if (p) {
    voci.push(
      <span key="p" className={cn(chip, p.className)}>
        <Flag className="size-3 fill-current" />
        Priorità {p.label.toLowerCase()}
      </span>,
    );
  }
  if (parsed.progetto) {
    voci.push(
      <span key="pr" className={chip}>
        <FolderKanban className="size-3" />
        {parsed.progetto.nome}
      </span>,
    );
  }
  if (parsed.cliente) {
    voci.push(
      <span key="c" className={chip}>
        <Building2 className="size-3" />
        {parsed.cliente.nome}
      </span>,
    );
  }
  for (const nome of parsed.nonTrovati) {
    voci.push(
      <span key={`n${nome}`} className={cn(chip, "bg-amber-50 text-amber-800")}>
        <AlertCircle className="size-3" />
        {nome} non trovato
      </span>,
    );
  }
  if (voci.length === 0) return null;
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground" aria-live="polite">
      {voci}
    </div>
  );
}

/** Versione compatta per le liste: un campo, Invio per salvare. */
export function AggiuntaRapida({
  defaults,
  placeholder,
  className,
}: {
  defaults: DefaultTask;
  placeholder?: string;
  className?: string;
}) {
  const stato = useAggiuntaRapida({ defaults });
  return (
    <CampoAggiuntaRapida
      stato={stato}
      onInvio={() => stato.salva(undefined, { chiudi: false })}
      placeholder={placeholder}
      className={className}
    />
  );
}
