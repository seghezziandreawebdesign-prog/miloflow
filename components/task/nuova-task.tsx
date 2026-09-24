"use client";

import { ChevronDown } from "lucide-react";
import { createContext, useContext, useState } from "react";

import { useApriEntita } from "@/components/drawer/use-apri-entita";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ambitoDiDefault, type FiltroAmbito } from "@/lib/ambito";
import { taskVuota, type TaskFormValues } from "@/lib/schemas/task";
import { cn } from "@/lib/utils";

import { CampiTask } from "./campi-task";
import { useOpzioniTask } from "./dati";
import { CampoAggiuntaRapida, useAggiuntaRapida, type DefaultTask } from "./aggiunta-rapida";

type Richiesta = Partial<TaskFormValues> & { apriDopo?: boolean };

const Context = createContext<{ apri: (richiesta?: Richiesta) => void } | null>(null);

/** Apre il dialog "Nuova task" da qualsiasi punto (menu +, ⌘K, pannelli, schede). */
export function useNuovaTask() {
  const ctx = useContext(Context);
  if (!ctx) throw new Error("useNuovaTask fuori da NuovaTaskProvider");
  return ctx.apri;
}

export function NuovaTaskProvider({
  filtroAmbito,
  children,
}: {
  filtroAmbito: FiltroAmbito;
  children: React.ReactNode;
}) {
  const [richiesta, setRichiesta] = useState<Richiesta | null>(null);
  // Ogni apertura rimonta il dialog, così parte sempre pulito.
  const [chiave, setChiave] = useState(0);

  return (
    <Context.Provider
      value={{
        apri: (r = {}) => {
          setRichiesta(r);
          setChiave((k) => k + 1);
        },
      }}
    >
      {children}
      {richiesta && (
        <NuovaTaskDialog
          key={chiave}
          defaults={{ ambito: ambitoDiDefault(filtroAmbito), ...richiesta }}
          apriDopo={richiesta.apriDopo ?? false}
          onClose={() => setRichiesta(null)}
        />
      )}
    </Context.Provider>
  );
}

function NuovaTaskDialog({
  defaults,
  apriDopo,
  onClose,
}: {
  defaults: DefaultTask;
  apriDopo: boolean;
  onClose: () => void;
}) {
  const [open, setOpen] = useState(true);
  const apriEntita = useApriEntita();
  const { data: opzioni } = useOpzioniTask();
  const [dettagli, setDettagli] = useState<TaskFormValues>(() => ({ ...taskVuota(defaults.ambito), ...defaults }));
  // Se il contesto porta già dei valori (servizio, cliente, date), i dettagli partono aperti.
  const [aperti, setAperti] = useState(
    Boolean(defaults.servizio_id || defaults.cliente_id || defaults.progetto_id || defaults.scadenza),
  );
  const stato = useAggiuntaRapida({
    defaults: { ambito: dettagli.ambito, titolo: defaults.titolo },
    onCreated: (id) => {
      setOpen(false);
      if (apriDopo) apriEntita({ tipo: "task", id });
    },
  });

  function chiudi(o: boolean) {
    setOpen(o);
  }

  return (
    <Dialog open={open} onOpenChange={chiudi} onOpenChangeComplete={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nuova task</DialogTitle>
          <DialogDescription>
            Scrivi in linguaggio naturale: date («domani», «ven», «12/10», «entro lunedì»), #cliente o #progetto,
            !alta !media !bassa.
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            stato.salva(dettagli);
          }}
        >
          <CampoAggiuntaRapida stato={stato} onInvio={() => stato.salva(dettagli)} autoFocus placeholder="Cosa devi fare?" />

          <Collapsible open={aperti} onOpenChange={setAperti}>
            <CollapsibleTrigger
              render={<Button type="button" variant="ghost" size="sm" className="-ml-2 text-muted-foreground" />}
            >
              <ChevronDown className={cn("transition-transform", aperti && "rotate-180")} />
              Altri dettagli
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3">
              <CampiTask
                valori={dettagli}
                onChange={(patch) => setDettagli((d) => ({ ...d, ...patch }))}
                opzioni={opzioni}
                idPrefix="nuova-task"
              />
              <p className="mt-3 text-xs text-muted-foreground">
                Quello che scrivi nel testo ha la precedenza su questi campi.
              </p>
            </CollapsibleContent>
          </Collapsible>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => chiudi(false)}>
              Annulla
            </Button>
            <Button type="submit" disabled={stato.pending || !stato.parsed.titolo}>
              {stato.pending ? "Salvataggio…" : "Crea task"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
