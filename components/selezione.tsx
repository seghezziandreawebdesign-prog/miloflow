"use client";

import { Check, CheckSquare, X } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Selezione multipla nelle liste (task, servizi). Le righe selezionabili hanno
// l'attributo data-selezionabile con il proprio id: da lì si ricavano l'ordine
// per la selezione con Shift e "Seleziona tutte", qualunque sia la vista.

const ATTRIBUTO = "data-selezionabile";

type Selezione = {
  attiva: boolean;
  setAttiva: (attiva: boolean) => void;
  selezionate: ReadonlySet<string>;
  /** Con `intervallo` (Shift) seleziona tutte le righe tra l'ultima toccata e questa. */
  toggle: (id: string, opzioni?: { intervallo?: boolean }) => void;
  selezionaTutte: () => void;
  svuota: () => void;
  /** Id delle righe visibili, nell'ordine della pagina. */
  visibili: () => string[];
};

const SelezioneContext = createContext<Selezione | null>(null);

/** La selezione della lista in cui si trova il componente, se c'è. */
export function useSelezione() {
  return useContext(SelezioneContext);
}

export function SelezioneProvider({ children, className }: { children: React.ReactNode; className?: string }) {
  const contenitore = useRef<HTMLDivElement>(null);
  const ultima = useRef<string | null>(null);
  const [attiva, setAttivaStato] = useState(false);
  const [selezionate, setSelezionate] = useState<ReadonlySet<string>>(new Set());

  const visibili = useCallback(() => {
    const righe = contenitore.current?.querySelectorAll<HTMLElement>(`[${ATTRIBUTO}]`) ?? [];
    // La stessa lista può esistere in due versioni (tabella su desktop, card su
    // mobile): contano solo le righe visibili, una volta sola.
    const ids = [...righe].filter((r) => r.offsetParent !== null).map((r) => r.getAttribute(ATTRIBUTO)!);
    return [...new Set(ids)];
  }, []);

  const setAttiva = useCallback((valore: boolean) => {
    setAttivaStato(valore);
    if (!valore) {
      setSelezionate(new Set());
      ultima.current = null;
    }
  }, []);

  const toggle = useCallback(
    (id: string, { intervallo = false }: { intervallo?: boolean } = {}) => {
      setAttivaStato(true);
      // L'ordine si legge adesso: l'aggiornamento dello stato gira più tardi.
      const ids = intervallo && ultima.current ? visibili() : [];
      const da = ids.indexOf(ultima.current ?? "");
      const a = ids.indexOf(id);
      setSelezionate((prima) => {
        const dopo = new Set(prima);
        if (da >= 0 && a >= 0) {
          for (const x of ids.slice(Math.min(da, a), Math.max(da, a) + 1)) dopo.add(x);
        } else if (dopo.has(id)) dopo.delete(id);
        else dopo.add(id);
        return dopo;
      });
      ultima.current = id;
    },
    [visibili],
  );

  const valore = useMemo<Selezione>(
    () => ({
      attiva,
      setAttiva,
      selezionate,
      toggle,
      selezionaTutte: () => setSelezionate(new Set(visibili())),
      svuota: () => setSelezionate(new Set()),
      visibili,
    }),
    [attiva, setAttiva, selezionate, toggle, visibili],
  );

  // Esc chiude la selezione.
  useEffect(() => {
    if (!attiva) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !document.querySelector("[role=dialog],[role=alertdialog],[role=menu]")) setAttiva(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [attiva, setAttiva]);

  return (
    <SelezioneContext.Provider value={valore}>
      {/* Spazio in fondo, così la barra fissa non copre le ultime righe. */}
      <div ref={contenitore} className={cn(className, attiva && "pb-32 sm:pb-20")}>
        {children}
      </div>
    </SelezioneContext.Provider>
  );
}

/** Attributi da mettere sulla riga selezionabile. */
export function attributiSelezione(id: string) {
  return { [ATTRIBUTO]: id };
}

/** Casella quadrata della selezione multipla. */
export function CasellaSelezione({
  id,
  etichetta,
  className,
}: {
  id: string;
  etichetta: string;
  className?: string;
}) {
  const selezione = useSelezione();
  if (!selezione) return null;
  const selezionata = selezione.selezionate.has(id);
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={selezionata}
      aria-label={`Seleziona «${etichetta}»`}
      onClick={(e) => {
        e.stopPropagation();
        selezione.toggle(id, { intervallo: e.shiftKey });
      }}
      onPointerDown={(e) => e.stopPropagation()}
      className={cn(
        "grid size-[18px] shrink-0 place-items-center rounded-[5px] border-[1.5px] border-muted-foreground/50 bg-card transition-colors outline-none hover:border-primary focus-visible:ring-3 focus-visible:ring-ring/50",
        selezionata && "border-primary bg-primary text-primary-foreground",
        className,
      )}
    >
      <Check strokeWidth={3} className={cn("size-3", selezionata ? "opacity-100" : "opacity-0")} />
    </button>
  );
}

/** Pulsante "Seleziona" / "Fine" per entrare e uscire dalla selezione. */
export function PulsanteSeleziona({ className }: { className?: string }) {
  const selezione = useSelezione();
  if (!selezione) return null;
  return (
    <Button
      variant={selezione.attiva ? "secondary" : "outline"}
      size="sm"
      onClick={() => selezione.setAttiva(!selezione.attiva)}
      aria-pressed={selezione.attiva}
      className={className}
    >
      <CheckSquare />
      {selezione.attiva ? "Fine" : "Seleziona"}
    </Button>
  );
}

/**
 * Barra fissa in basso con il conteggio e le azioni sulle righe selezionate.
 * Compare solo in modalità selezione.
 */
export function BarraSelezione({ children }: { children: React.ReactNode }) {
  const selezione = useSelezione();
  if (!selezione?.attiva) return null;
  const n = selezione.selezionate.size;
  const tutte = n > 0 && n >= selezione.visibili().length;

  return (
    <div
      role="toolbar"
      aria-label="Azioni sulla selezione"
      data-barra-selezione=""
      className="fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))] lg:left-56"
    >
      {/* Su mobile due righe: conteggio sopra, azioni sotto a tutta larghezza. */}
      <div className="flex w-full flex-col gap-1 rounded-2xl bg-card p-1.5 shadow-[0_8px_30px_rgba(0,0,0,0.12)] ring-1 ring-black/10 sm:w-auto sm:max-w-full sm:flex-row sm:items-center">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon-sm" aria-label="Chiudi la selezione" onClick={() => selezione.setAttiva(false)}>
            <X />
          </Button>
          <span className="px-1 text-sm font-medium whitespace-nowrap tabular-nums">
            {n === 0 ? "Nessuna" : n === 1 ? "1 selezionata" : `${n} selezionate`}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto text-primary sm:ml-0"
            onClick={() => (tutte ? selezione.svuota() : selezione.selezionaTutte())}
          >
            {tutte ? "Nessuna" : "Tutte"}
          </Button>
        </div>
        <span className="mx-1 hidden h-5 w-px shrink-0 bg-border sm:block" />
        <div
          className={cn(
            "flex items-center justify-between gap-1 border-t pt-1 sm:justify-start sm:border-t-0 sm:pt-0",
            n === 0 && "pointer-events-none opacity-40",
          )}
          aria-disabled={n === 0}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
