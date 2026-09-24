"use client";

import { useQueryClient } from "@tanstack/react-query";
import { CornerLeftUp, FolderKanban, Hourglass, MoreHorizontal, RefreshCw, Trash2 } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { Segmented } from "@/components/segmented";
import { AggiuntaRapida } from "@/components/task/aggiunta-rapida";
import { CampiTask, TestoAlBlur } from "@/components/task/campi-task";
import { invalidaTask, useAggiornaTask, useOpzioniTask, useTaskDettaglio, type TaskLista } from "@/components/task/dati";
import { InAttesaDialog } from "@/components/task/in-attesa-dialog";
import { TaskCheckbox } from "@/components/task/task-checkbox";
import { TaskRow } from "@/components/task/task-row";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { deleteTask } from "@/lib/actions/task";
import { formatDate, todayISO } from "@/lib/dates/format";
import { APRI_PARAM } from "@/lib/entita";
import { taskToDb, type TaskFormValues } from "@/lib/schemas/task";
import { giorniInAttesa, statoTask } from "@/lib/task";
import { cn } from "@/lib/utils";

import { useApriEntita } from "./use-apri-entita";

const STATI_APERTI = [
  { value: "da_fare", label: "Da fare" },
  { value: "in_corso", label: "In corso" },
  { value: "in_attesa", label: "In attesa" },
] as const;

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
      <SheetHeader>
        <SheetTitle>Task non trovata</SheetTitle>
        <SheetDescription>Potrebbe essere stata eliminata, oppure non hai accesso.</SheetDescription>
      </SheetHeader>
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
    <div className="flex h-full flex-col overflow-y-auto">
      <SheetHeader className="gap-3 pr-12">
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
          <SheetTitle className="sr-only">{task.titolo}</SheetTitle>
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
        <SheetDescription className="flex flex-wrap items-center gap-2 text-xs">
          <span className={cn("rounded-full px-2 py-0.5 ring-1 ring-inset", statoTask(task.stato).className)}>
            {statoTask(task.stato).label}
          </span>
          {task.ambito === "personale" && (
            <span className="rounded-full bg-ambito-personale-soft px-2 py-0.5 text-ambito-personale">Personale</span>
          )}
          {fatta && task.completata_il && <span>Completata il {formatDate(task.completata_il)}</span>}
        </SheetDescription>
      </SheetHeader>

      <div className="space-y-6 px-4 pb-6">
        {!fatta && (
          <Segmented
            label="Stato"
            value={task.stato as (typeof STATI_APERTI)[number]["value"]}
            opzioni={STATI_APERTI}
            onChange={(stato) => {
              if (stato === task.stato) return;
              if (stato === "in_attesa") setAttesaOpen(true);
              else salva({ stato });
            }}
          />
        )}

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

        {task.servizi && (
          <button
            type="button"
            onClick={() => apri({ tipo: "servizio", id: task.servizi!.id })}
            className="flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm hover:bg-muted/60"
          >
            <RefreshCw className="size-4 text-muted-foreground" />
            <span className="text-muted-foreground">Servizio</span>
            <span className="truncate font-medium">{task.servizi.nome}</span>
          </button>
        )}
        {task.progetti && (
          <button
            type="button"
            onClick={() => apri({ tipo: "progetto", id: task.progetti!.id })}
            className="flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm hover:bg-muted/60"
          >
            <FolderKanban className="size-4 text-muted-foreground" />
            <span className="text-muted-foreground">Progetto</span>
            <span className="truncate font-medium">{task.progetti.nome}</span>
            {task.cliente_nome && <span className="ml-auto truncate text-xs text-muted-foreground">{task.cliente_nome}</span>}
          </button>
        )}

        <CampiTask
          valori={valori}
          onChange={salva}
          opzioni={opzioni}
          sottotask={isSottotask}
          idPrefix={`task-${id}`}
        />

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
