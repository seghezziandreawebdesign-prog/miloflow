"use client";

import { useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Check, CircleDot, Flag, FolderKanban, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { it } from "react-day-picker/locale";
import { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { BarraSelezione, useSelezione } from "@/components/selezione";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { completaTasks, deleteTasks, updateTasks } from "@/lib/actions/task";
import { todayISO } from "@/lib/dates/format";
import { addDays } from "@/lib/dates/giorni";
import type { TaskMultiplaPatch } from "@/lib/schemas/task";
import { PRIORITA } from "@/lib/task";

import { chiaviTask, invalidaTask, useOpzioniTask, type TaskLista } from "./dati";
import { InAttesaDialog } from "./in-attesa-dialog";

function toISODate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** Le task selezionate, cercate nelle liste già in cache. */
function taskInCache(queryClient: ReturnType<typeof useQueryClient>, ids: ReadonlySet<string>): TaskLista[] {
  const trovate = new Map<string, TaskLista>();
  for (const [, dati] of queryClient.getQueriesData<unknown>({ queryKey: chiaviTask.tutte })) {
    if (!Array.isArray(dati)) continue;
    for (const t of dati as TaskLista[]) if (ids.has(t.id)) trovate.set(t.id, t);
  }
  return [...trovate.values()];
}

/** Barra delle azioni sulle task selezionate. Va messa dentro un SelezioneProvider. */
export function AzioniMultipleTask() {
  const selezione = useSelezione();
  const queryClient = useQueryClient();
  const router = useRouter();
  const { data: opzioni } = useOpzioniTask();
  const [eliminaOpen, setEliminaOpen] = useState(false);
  const [attesaOpen, setAttesaOpen] = useState(false);
  const [sottotaskOpen, setSottotaskOpen] = useState(false);
  const [dataOpen, setDataOpen] = useState(false);
  if (!selezione) return null;

  const ids = [...selezione.selezionate];
  const n = ids.length;
  const oggi = todayISO();

  function dopo() {
    invalidaTask(queryClient);
    router.refresh();
  }

  async function modifica(patch: TaskMultiplaPatch, messaggio: string) {
    const result = await updateTasks(ids, patch);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(`${messaggio}: ${result.data.aggiornate === 1 ? "1 task" : `${result.data.aggiornate} task`}`);
    dopo();
  }

  async function completa(sottotask: boolean) {
    const aperte = taskInCache(queryClient, selezione!.selezionate).filter((t) => t.stato !== "fatto");
    const daCompletare = aperte.length > 0 ? aperte.map((t) => t.id) : ids;
    const result = await completaTasks(daCompletare, { sottotask });
    if (!result.ok) toast.error(result.error);
    else toast.success(result.data.completate === 1 ? "1 task completata" : `${result.data.completate} task completate`);
    selezione!.setAttiva(false);
    dopo();
  }

  function chiediCompleta() {
    const conSottotask = taskInCache(queryClient, selezione!.selezionate).some((t) => t.stato !== "fatto" && t.sottotask_aperte > 0);
    if (conSottotask) setSottotaskOpen(true);
    else void completa(false);
  }

  const sottotaskDaEliminare = taskInCache(queryClient, selezione.selezionate).reduce(
    (acc, t) => acc + (t.parent_id ? 0 : t.sottotask_totali),
    0,
  );

  return (
    <>
      <BarraSelezione>
        <Button variant="ghost" size="sm" onClick={chiediCompleta}>
          <Check />
          <span className="max-sm:sr-only">Completa</span>
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" size="sm" />}>
            <CalendarDays />
            <span className="max-sm:sr-only">Inizio</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="center" className="w-48">
            <DropdownMenuLabel>Data di inizio</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => modifica({ data_pianificata: oggi }, "Iniziano oggi")}>Oggi</DropdownMenuItem>
            <DropdownMenuItem onClick={() => modifica({ data_pianificata: addDays(oggi, 1) }, "Iniziano domani")}>Domani</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setDataOpen(true)}>Scegli una data…</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => modifica({ data_pianificata: "" }, "Data tolta")}>Togli la data</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" size="sm" />}>
            <Flag />
            <span className="max-sm:sr-only">Priorità</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="center" className="w-44">
            <DropdownMenuLabel>Priorità</DropdownMenuLabel>
            {PRIORITA.map((p) => (
              <DropdownMenuItem key={p.value} onClick={() => modifica({ priorita: String(p.value) as "1" | "2" | "3" }, "Priorità cambiata")}>
                <Flag className={p.className} />
                {p.label}
              </DropdownMenuItem>
            ))}
            <DropdownMenuItem onClick={() => modifica({ priorita: "" }, "Priorità tolta")}>Nessuna</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" size="sm" />}>
            <CircleDot />
            <span className="max-sm:sr-only">Stato</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="center" className="w-44">
            <DropdownMenuLabel>Stato</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => modifica({ stato: "da_fare" }, "Stato cambiato")}>Da fare</DropdownMenuItem>
            <DropdownMenuItem onClick={() => modifica({ stato: "in_corso" }, "Stato cambiato")}>In corso</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setAttesaOpen(true)}>In attesa…</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" size="sm" />}>
            <FolderKanban />
            <span className="max-sm:sr-only">Progetto</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="center" className="max-h-80 w-56">
            <DropdownMenuLabel>Sposta nel progetto</DropdownMenuLabel>
            {(opzioni?.progetti ?? []).map((p) => (
              <DropdownMenuItem key={p.id} onClick={() => modifica({ progetto_id: p.id }, `Spostate in «${p.nome}»`)}>
                <span className="truncate">{p.nome}</span>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => modifica({ progetto_id: "" }, "Tolte dal progetto")}>Nessun progetto</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => setEliminaOpen(true)}>
          <Trash2 />
          <span className="max-sm:sr-only">Elimina</span>
        </Button>
      </BarraSelezione>

      <Dialog open={dataOpen} onOpenChange={setDataOpen}>
        <DialogContent className="w-auto sm:max-w-fit">
          <DialogHeader>
            <DialogTitle>Data di inizio</DialogTitle>
          </DialogHeader>
          <Calendar
            mode="single"
            locale={it}
            weekStartsOn={1}
            className="mx-auto"
            onSelect={(date) => {
              setDataOpen(false);
              if (date) void modifica({ data_pianificata: toISODate(date) }, "Data di inizio cambiata");
            }}
          />
        </DialogContent>
      </Dialog>
      <InAttesaDialog
        open={attesaOpen}
        onOpenChange={setAttesaOpen}
        valore=""
        onConferma={(inAttesaDi) => void modifica({ stato: "in_attesa", in_attesa_di: inAttesaDi }, "In attesa")}
      />
      <AlertDialog open={sottotaskOpen} onOpenChange={setSottotaskOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Completare anche le sottotask?</AlertDialogTitle>
            <AlertDialogDescription>Alcune delle task selezionate hanno sottotask aperte.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <Button
              variant="outline"
              onClick={() => {
                setSottotaskOpen(false);
                void completa(false);
              }}
            >
              Solo le task
            </Button>
            <Button
              onClick={() => {
                setSottotaskOpen(false);
                void completa(true);
              }}
            >
              Completa tutto
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <ConfirmDialog
        open={eliminaOpen}
        onOpenChange={setEliminaOpen}
        title={n === 1 ? "Eliminare la task selezionata?" : `Eliminare ${n} task?`}
        description={
          sottotaskDaEliminare > 0
            ? `Verranno eliminate anche ${sottotaskDaEliminare === 1 ? "1 sottotask" : `${sottotaskDaEliminare} sottotask`} e gli allegati. L'operazione non si può annullare.`
            : "Verranno eliminati anche gli allegati. L'operazione non si può annullare."
        }
        onConfirm={async () => {
          const result = await deleteTasks(ids);
          if (!result.ok) {
            toast.error(result.error);
            return false;
          }
          toast.success(result.data.eliminate === 1 ? "Task eliminata" : `${result.data.eliminate} task eliminate`);
          selezione.setAttiva(false);
          dopo();
        }}
      />
    </>
  );
}
