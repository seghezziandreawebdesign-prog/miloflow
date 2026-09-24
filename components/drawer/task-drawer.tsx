"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Building2, ChevronDown, CornerLeftUp, FolderKanban, Hourglass, MoreHorizontal, RefreshCw, Trash2 } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { EditorTesto } from "@/components/editor-testo";
import { AggiuntaRapida } from "@/components/task/aggiunta-rapida";
import { AllegatiTask, useAllegatiTask, useRicezioneFile } from "@/components/task/allegati";
import { CampiPrincipali, CampiTask, TestoAlBlur } from "@/components/task/campi-task";
import { invalidaTask, useAggiornaTask, useOpzioniTask, useTaskDettaglio, type TaskLista } from "@/components/task/dati";
import { InAttesaDialog } from "@/components/task/in-attesa-dialog";
import { TaskCheckbox, useCompletaConConferma } from "@/components/task/task-checkbox";
import { TaskRow } from "@/components/task/task-row";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PannelloDescription, PannelloHeader, PannelloTitle } from "@/components/drawer/pannello";
import { Skeleton } from "@/components/ui/skeleton";
import { deleteTask } from "@/lib/actions/task";
import { formatDate, todayISO } from "@/lib/dates/format";
import { APRI_PARAM } from "@/lib/entita";
import { taskToDb, type TaskFormValues } from "@/lib/schemas/task";
import { giorniInAttesa } from "@/lib/task";
import { cn } from "@/lib/utils";

import { useApriEntita } from "./use-apri-entita";

/** Valori del form a partire dalla riga del database. */
function valoriForm(t: TaskLista): TaskFormValues {
  return {
    titolo: t.titolo,
    note: t.note ?? "",
    ambito: t.ambito,
    stato: t.stato,
    in_attesa_di: t.in_attesa_di ?? "",
    priorita: t.priorita ? (String(t.priorita) as TaskFormValues["priorita"]) : "",
    data_pianificata: t.data_pianificata ?? "",
    ora_inizio: t.ora_inizio ? t.ora_inizio.slice(0, 5) : "",
    scadenza: t.scadenza ?? "",
    durata_min: t.durata_min ? String(t.durata_min) : "",
    ricorrenza: t.ricorrenza ?? "",
    progetto_id: t.progetto_id ?? "",
    cliente_id: t.cliente_id ?? "",
    servizio_id: t.servizio_id ?? "",
    parent_id: t.parent_id ?? "",
    assegnata_a: t.assegnata_a ?? "",
  };
}

export function TaskDrawer({ id }: { id: string }) {
  const { data, isPending, isError } = useTaskDettaglio(id);
  const { data: opzioni } = useOpzioniTask();
  const aggiorna = useAggiornaTask();
  const apri = useApriEntita();
  const queryClient = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [attesaOpen, setAttesaOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [dettagliAperti, setDettagliAperti] = useState(false);
  const allegati = useAllegatiTask(id);
  const ricezione = useRicezioneFile(allegati.carica);
  const spunta = useCompletaConConferma();

  if (isPending) {
    return (
      <div className="space-y-3 p-4">
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }
  if (isError || !data) {
    return (
      <PannelloHeader>
        <PannelloTitle>Task non trovata</PannelloTitle>
        <PannelloDescription>Potrebbe essere stata eliminata, oppure non hai accesso.</PannelloDescription>
      </PannelloHeader>
    );
  }

  const { task, sottotask } = data;
  const valori = valoriForm(task);
  const fatta = task.stato === "fatto";
  const attesa = giorniInAttesa(task, todayISO());
  const isSottotask = task.parent_id !== null;

  function salva(patch: Partial<TaskFormValues>) {
    aggiorna.mutate({ id, patch, cache: taskToDb(patch) });
  }

  function chiudi() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete(APRI_PARAM);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  return (
    <div
      className={cn("flex min-h-[50svh] flex-col lg:min-h-full", ricezione.trascinando && "bg-primary/5 ring-2 ring-primary ring-inset")}
      {...ricezione.props}
    >
      <PannelloHeader className="gap-3 pr-12 sm:pr-14">
        {task.genitore && (
          <button
            type="button"
            onClick={() => apri({ tipo: "task", id: task.genitore!.id })}
            className="inline-flex w-fit items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <CornerLeftUp className="size-3" />
            Sottotask di «{task.genitore.titolo}»
          </button>
        )}
        <div className="flex items-start gap-3">
          <TaskCheckbox task={task} className="mt-1.5 size-5" />
          <PannelloTitle className="sr-only">{task.titolo}</PannelloTitle>
          <TestoAlBlur
            aria-label="Titolo"
            value={task.titolo}
            onCommit={(v) => (v.trim() ? salva({ titolo: v.trim() }) : toast.error("Il titolo non può essere vuoto"))}
            className={cn(
              "h-auto border-transparent px-1 py-0.5 text-lg font-semibold shadow-none hover:border-input focus-visible:border-ring md:text-lg",
              fatta && "text-muted-foreground line-through",
            )}
          />
        </div>
        <PannelloDescription className="flex flex-wrap items-center gap-2 text-xs empty:hidden">
          {task.ambito === "personale" && (
            <span className="rounded-full bg-ambito-personale-soft px-2 py-0.5 text-ambito-personale">Personale</span>
          )}
          {fatta && task.completata_il && <span>Completata il {formatDate(task.completata_il)}</span>}
        </PannelloDescription>
      </PannelloHeader>

      {/* Su schermi larghi due colonne: la descrizione a tutta altezza a sinistra, i campi a destra. */}
      <div className="grid gap-6 px-4 pb-5 sm:px-5 lg:flex-1 lg:grid-cols-[minmax(0,1fr)_minmax(320px,380px)] lg:gap-8">
        <div className="flex min-w-0 flex-col gap-4">
          {(task.progetti || task.cliente_nome || task.servizi) && (
            <div className="-mt-2 flex flex-wrap gap-2 text-xs">
              {task.progetti && (
                <Collegamento icona={FolderKanban} onClick={() => apri({ tipo: "progetto", id: task.progetti!.id })}>
                  {task.progetti.nome}
                </Collegamento>
              )}
              {task.cliente_id && task.cliente_nome && (
                <Collegamento icona={Building2} onClick={() => apri({ tipo: "cliente", id: task.cliente_id! })}>
                  {task.cliente_nome}
                </Collegamento>
              )}
              {task.servizi && (
                <Collegamento icona={RefreshCw} onClick={() => apri({ tipo: "servizio", id: task.servizi!.id })}>
                  {task.servizi.nome}
                </Collegamento>
              )}
            </div>
          )}

          <Field className="lg:flex-1">
            <FieldLabel htmlFor={`task-${id}-descrizione`}>Descrizione</FieldLabel>
            <EditorTesto
              id={`task-${id}-descrizione`}
              value={valori.note}
              onChange={(note) => salva({ note })}
              className="lg:flex-1"
              classeContenuto="min-h-40 sm:min-h-64 lg:min-h-[calc(90svh-14rem)]"
            />
          </Field>
        </div>

        <div className="min-w-0 space-y-6">
          <CampiPrincipali
            valori={valori}
            onChange={salva}
            onStato={(stato) => {
              if (stato === task.stato) return;
              if (stato === "fatto") spunta.completa(task);
              else if (task.stato === "fatto") {
                // Riaprendo si passa dallo stato scelto; "in attesa" chiede di cosa.
                if (stato === "in_attesa") setAttesaOpen(true);
                else salva({ stato });
              } else if (stato === "in_attesa") setAttesaOpen(true);
              else salva({ stato });
            }}
            idPrefix={`task-${id}`}
            senzaDescrizione
          />

          {task.stato === "in_attesa" && (
            <div className="flex items-start gap-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
              <Hourglass className="mt-0.5 size-4 shrink-0" />
              <div className="min-w-0 flex-1">
                <p>
                  In attesa{task.in_attesa_di ? <> di <strong>{task.in_attesa_di}</strong></> : null}
                  {attesa !== null && (attesa === 0 ? " da oggi" : ` da ${attesa} ${attesa === 1 ? "giorno" : "giorni"}`)}
                </p>
                {task.in_attesa_dal && <p className="text-xs opacity-80">dal {formatDate(task.in_attesa_dal)}</p>}
              </div>
              <Button variant="ghost" size="sm" onClick={() => setAttesaOpen(true)}>
                Modifica
              </Button>
            </div>
          )}

          <AllegatiTask stato={allegati} />

          {!isSottotask && (
            <section className="space-y-2">
              <h3 className="text-sm font-medium">
                Sottotask
                {sottotask.length > 0 && (
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    {sottotask.filter((s) => s.stato === "fatto").length}/{sottotask.length}
                  </span>
                )}
              </h3>
              {sottotask.length > 0 && (
                <div className="-mx-2">
                  {sottotask.map((s) => (
                    <TaskRow key={s.id} task={s} opzioni={{ senzaProgetto: true, senzaCliente: true }} />
                  ))}
                </div>
              )}
              <AggiuntaRapida
                defaults={{ ambito: task.ambito, parent_id: id }}
                placeholder="Aggiungi una sottotask"
              />
            </section>
          )}

          <Collapsible open={dettagliAperti} onOpenChange={setDettagliAperti} className="border-t pt-3">
            <CollapsibleTrigger
              render={<Button type="button" variant="ghost" size="sm" className="-ml-2 text-muted-foreground" />}
            >
              <ChevronDown className={cn("transition-transform", dettagliAperti && "rotate-180")} />
              Dettagli
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3">
              <CampiTask
                valori={valori}
                onChange={salva}
                opzioni={opzioni}
                sottotask={isSottotask}
                idPrefix={`task-${id}`}
              />
            </CollapsibleContent>
          </Collapsible>

          <div className="flex items-center justify-between border-t pt-4 text-xs text-muted-foreground">
            <span>Creata il {formatDate(task.created_at)}</span>
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="outline" size="icon-sm" aria-label="Altre azioni" />}>
                <MoreHorizontal />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem variant="destructive" onClick={() => setDeleteOpen(true)}>
                  <Trash2 />
                  Elimina
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {spunta.dialog}
      <InAttesaDialog
        open={attesaOpen}
        onOpenChange={setAttesaOpen}
        valore={task.in_attesa_di ?? ""}
        onConferma={(inAttesaDi) => salva({ stato: "in_attesa", in_attesa_di: inAttesaDi })}
      />
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Eliminare la task?"
        description={
          sottotask.length > 0
            ? `Verranno eliminate anche ${sottotask.length === 1 ? "la sottotask" : `le ${sottotask.length} sottotask`}. L'operazione non si può annullare.`
            : "L'operazione non si può annullare."
        }
        onConfirm={async () => {
          const result = await deleteTask(id);
          if (!result.ok) {
            toast.error(result.error);
            return false;
          }
          toast.success("Task eliminata");
          invalidaTask(queryClient);
          chiudi();
          router.refresh();
        }}
      />
    </div>
  );
}

function Collegamento({
  icona: Icona,
  onClick,
  children,
}: {
  icona: typeof FolderKanban;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex max-w-full items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-muted-foreground hover:bg-muted/70 hover:text-foreground"
    >
      <Icona className="size-3 shrink-0" />
      <span className="truncate">{children}</span>
    </button>
  );
}
