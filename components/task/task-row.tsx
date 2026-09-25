"use client";

import { Building2, CalendarDays, CornerDownRight, Flag, FolderKanban, Hourglass, ListChecks, Repeat, Text } from "lucide-react";

import { ClienteLogo } from "@/components/clienti/cliente-logo";
import { useApriEntita } from "@/components/drawer/use-apri-entita";
import { attributiSelezione, CasellaSelezione, useSelezione } from "@/components/selezione";
import { formatGiornoRelativo, todayISO } from "@/lib/dates/format";
import { descriviRicorrenza } from "@/lib/dates/ricorrenza";
import { giorniInAttesa, GIORNI_SOLLECITO } from "@/lib/task";
import { testoSemplice } from "@/lib/testo-ricco";
import { cn } from "@/lib/utils";

import type { TaskLista } from "./dati";
import { EliminaTaskButton } from "./elimina-task";
import { TaskCheckbox } from "./task-checkbox";

export type OpzioniRiga = {
  /** Nasconde il progetto (es. dentro la pagina del progetto). */
  senzaProgetto?: boolean;
  /** Nasconde il cliente (es. nella scheda cliente). */
  senzaCliente?: boolean;
  /** Nasconde la data pianificata (es. nelle viste già raggruppate per giorno). */
  senzaData?: boolean;
  /** Niente barra colorata del progetto a sinistra (es. nelle schede della board, che hanno già il bordo). */
  senzaBarra?: boolean;
  /** Niente cestino sulla riga. */
  senzaElimina?: boolean;
};

export function TaskRow({
  task,
  opzioni = {},
  className,
  children,
}: {
  task: TaskLista;
  opzioni?: OpzioniRiga;
  className?: string;
  /** Contenuto a destra (es. maniglia di trascinamento). */
  children?: React.ReactNode;
}) {
  const apri = useApriEntita();
  const selezione = useSelezione();
  const selezionando = selezione?.attiva ?? false;
  const selezionata = selezione?.selezionate.has(task.id) ?? false;
  const fatta = task.stato === "fatto";
  const colore = !opzioni.senzaBarra ? (task.progetti?.colore ?? null) : null;

  // In modalità selezione un clic sulla riga la seleziona invece di aprirla.
  function attiva(intervallo: boolean) {
    if (selezionando) selezione!.toggle(task.id, { intervallo });
    else apri({ tipo: "task", id: task.id });
  }

  return (
    <div
      role="button"
      tabIndex={0}
      {...(selezione ? attributiSelezione(task.id) : {})}
      aria-pressed={selezionando ? selezionata : undefined}
      style={colore ? { borderLeftColor: colore } : undefined}
      onClick={(e) => attiva(e.shiftKey)}
      onKeyDown={(e) => {
        if (e.key === "Enter" && e.target === e.currentTarget) attiva(false);
      }}
      className={cn(
        "group flex cursor-pointer items-start gap-3 rounded-lg border-l-[3px] border-l-transparent px-2 py-2 outline-none hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50",
        selezionando && "select-none",
        selezionata && "bg-primary-soft hover:bg-primary-soft",
        className,
      )}
    >
      {selezionando ? (
        <CasellaSelezione id={task.id} etichetta={task.titolo} className="mt-0.5" />
      ) : (
        <TaskCheckbox task={task} className="mt-0.5" />
      )}
      <div className="min-w-0 flex-1">
        <p className={cn("text-sm leading-5 break-words", fatta && "text-muted-foreground line-through")}>
          {task.titolo}
        </p>
        <TaskMeta task={task} opzioni={opzioni} />
      </div>
      {/* Il logo dice a colpo d'occhio di quale cliente è la task. */}
      {task.clienti && !opzioni.senzaCliente && (
        <span title={task.cliente_nome ?? undefined} className="mt-0.5">
          <ClienteLogo
            nome={task.cliente_nome ?? ""}
            colore={task.clienti.colore}
            logoUrl={task.cliente_logo_url}
            sito={task.clienti.sito}
            size="xs"
          />
        </span>
      )}
      {!selezionando && !opzioni.senzaElimina && <EliminaTaskButton task={task} />}
      {children}
    </div>
  );
}

export function TaskMeta({ task, opzioni = {} }: { task: TaskLista; opzioni?: OpzioniRiga }) {
  const oggi = todayISO();
  const aperta = task.stato !== "fatto";
  const attesa = giorniInAttesa(task, oggi);
  const ricorrenza = descriviRicorrenza(task.ricorrenza);

  const voci: React.ReactNode[] = [];
  if (task.genitore) {
    voci.push(
      <span key="genitore" className="inline-flex min-w-0 items-center gap-1">
        <CornerDownRight className="size-3 shrink-0" />
        <span className="truncate">{task.genitore.titolo}</span>
      </span>,
    );
  }
  if (task.data_pianificata && !opzioni.senzaData) {
    const ritardo = aperta && task.data_pianificata < oggi;
    voci.push(
      <span key="data" className={cn("inline-flex items-center gap-1", ritardo && "font-medium text-red-600")}>
        <CalendarDays className="size-3" />
        {formatGiornoRelativo(task.data_pianificata, oggi)}
      </span>,
    );
  }
  if (task.scadenza) {
    const scaduta = aperta && task.scadenza < oggi;
    const oggiScade = aperta && task.scadenza === oggi;
    voci.push(
      <span
        key="scadenza"
        className={cn(
          "inline-flex items-center gap-1",
          scaduta && "font-medium text-red-600",
          oggiScade && "font-medium text-amber-700",
        )}
        title="Scadenza"
      >
        <Flag className="size-3" />
        entro {formatGiornoRelativo(task.scadenza, oggi).toLowerCase()}
      </span>,
    );
  }
  if (task.note && testoSemplice(task.note)) {
    voci.push(
      <span key="note" className="inline-flex items-center" title="Ha una descrizione">
        <Text className="size-3" />
        <span className="sr-only">Ha una descrizione</span>
      </span>,
    );
  }
  if (ricorrenza) {
    voci.push(
      <span key="ricorrenza" className="inline-flex items-center gap-1" title={ricorrenza}>
        <Repeat className="size-3" />
        <span className="sr-only">{ricorrenza}</span>
      </span>,
    );
  }
  if (attesa !== null) {
    voci.push(
      <span
        key="attesa"
        className={cn("inline-flex items-center gap-1", attesa > GIORNI_SOLLECITO && "font-medium text-amber-700")}
      >
        <Hourglass className="size-3" />
        {task.in_attesa_di ? `${task.in_attesa_di} · ` : ""}
        {attesa === 0 ? "da oggi" : attesa === 1 ? "da 1 giorno" : `da ${attesa} giorni`}
      </span>,
    );
  }
  if (task.sottotask_totali > 0) {
    voci.push(
      <span key="sottotask" className="inline-flex items-center gap-1">
        <ListChecks className="size-3" />
        {task.sottotask_totali - task.sottotask_aperte}/{task.sottotask_totali}
      </span>,
    );
  }
  if (task.progetti && !opzioni.senzaProgetto) {
    voci.push(
      <span key="progetto" className="inline-flex min-w-0 items-center gap-1">
        <FolderKanban className="size-3 shrink-0" style={task.progetti.colore ? { color: task.progetti.colore } : undefined} />
        <span className="truncate">{task.progetti.nome}</span>
      </span>,
    );
  }
  if (task.cliente_nome && !opzioni.senzaCliente && !(task.progetti && !opzioni.senzaProgetto)) {
    voci.push(
      <span key="cliente" className="inline-flex min-w-0 items-center gap-1">
        <Building2 className="size-3 shrink-0" />
        <span className="truncate">{task.cliente_nome}</span>
      </span>,
    );
  }

  if (voci.length === 0) return null;
  return <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">{voci}</div>;
}
