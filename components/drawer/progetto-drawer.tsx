"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Archive, ArrowRight, Building2, CheckCircle2, MoreHorizontal, Pause, Pencil, Play } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { AggiuntaRapida } from "@/components/task/aggiunta-rapida";
import { invalidaTask, useProgetto, useTaskProgetto } from "@/components/task/dati";
import { ProgettoDialog } from "@/components/task/progetto-dialog";
import { Progresso } from "@/components/task/progresso";
import { TaskRow } from "@/components/task/task-row";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PannelloDescription, PannelloHeader, PannelloTitle } from "@/components/drawer/pannello";
import { Skeleton } from "@/components/ui/skeleton";
import { setStatoProgetto } from "@/lib/actions/task";
import { formatDate } from "@/lib/dates/format";
import { confrontaTask, statoProgetto, type StatoProgetto } from "@/lib/task";
import { cn } from "@/lib/utils";

import { useApriEntita } from "./use-apri-entita";

const MAX_TASK = 8;

export function ProgettoDrawer({ id }: { id: string }) {
  const { data: progetto, isPending, isError } = useProgetto(id);
  const { data: tasks } = useTaskProgetto(id);
  const queryClient = useQueryClient();
  const router = useRouter();
  const apri = useApriEntita();
  const [editOpen, setEditOpen] = useState(false);
  const [, startTransition] = useTransition();

  if (isPending) {
    return (
      <div className="space-y-3 p-4">
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }
  if (isError || !progetto) {
    return (
      <PannelloHeader>
        <PannelloTitle>Progetto non trovato</PannelloTitle>
        <PannelloDescription>Potrebbe essere stato eliminato, oppure non hai accesso.</PannelloDescription>
      </PannelloHeader>
    );
  }

  const stato = statoProgetto(progetto.stato ?? "attivo");
  const aperte = (tasks ?? []).filter((t) => t.stato !== "fatto").sort(confrontaTask);

  function cambiaStato(nuovo: StatoProgetto, messaggio: string) {
    startTransition(async () => {
      const result = await setStatoProgetto(id, nuovo);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(messaggio);
      invalidaTask(queryClient);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col">
      <PannelloHeader className="gap-2 pr-12 sm:pr-14">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="size-2.5 rounded-full" style={{ backgroundColor: progetto.colore ?? "var(--muted-foreground)" }} />
          Progetto
          {progetto.ambito === "personale" && (
            <span className="rounded-full bg-ambito-personale-soft px-2 py-0.5 text-xs text-ambito-personale">Personale</span>
          )}
        </div>
        <PannelloTitle className="text-lg">{progetto.nome}</PannelloTitle>
        <PannelloDescription className="flex flex-wrap items-center gap-2">
          <span className={cn("rounded-full px-2 py-0.5 text-xs ring-1 ring-inset", stato.className)}>{stato.label}</span>
          {progetto.scadenza && <span>Scadenza {formatDate(progetto.scadenza)}</span>}
        </PannelloDescription>
      </PannelloHeader>

      <div className="space-y-6 px-4 pb-5 sm:px-5">
        <div className="flex flex-wrap gap-2">
          <Link href={`/task/progetti/${id}`} className={buttonVariants()}>
            Apri il progetto
            <ArrowRight />
          </Link>
          <Button variant="outline" size="icon" onClick={() => setEditOpen(true)} aria-label="Modifica">
            <Pencil />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" size="icon" aria-label="Altre azioni" />}>
              <MoreHorizontal />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              {progetto.stato !== "completato" && (
                <DropdownMenuItem onClick={() => cambiaStato("completato", "Progetto completato")}>
                  <CheckCircle2 />
                  Segna come completato
                </DropdownMenuItem>
              )}
              {progetto.stato === "attivo" && (
                <DropdownMenuItem onClick={() => cambiaStato("in_pausa", "Progetto in pausa")}>
                  <Pause />
                  Metti in pausa
                </DropdownMenuItem>
              )}
              {progetto.stato !== "attivo" && (
                <DropdownMenuItem onClick={() => cambiaStato("attivo", "Progetto riattivato")}>
                  <Play />
                  Riattiva
                </DropdownMenuItem>
              )}
              {progetto.stato !== "archiviato" && (
                <DropdownMenuItem onClick={() => cambiaStato("archiviato", "Progetto archiviato")}>
                  <Archive />
                  Archivia
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <Progresso fatte={progetto.task_fatte ?? 0} totali={progetto.task_totali ?? 0} colore={progetto.colore} />

        {progetto.cliente_id && progetto.cliente_nome && (
          <button
            type="button"
            onClick={() => apri({ tipo: "cliente", id: progetto.cliente_id! })}
            className="flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm hover:bg-muted/60"
          >
            <Building2 className="size-4 text-muted-foreground" />
            <span className="text-muted-foreground">Cliente</span>
            <span className="truncate font-medium">{progetto.cliente_nome}</span>
          </button>
        )}

        {progetto.descrizione && <p className="text-sm whitespace-pre-line">{progetto.descrizione}</p>}

        <section className="space-y-2">
          <h3 className="text-sm font-medium">Task aperte</h3>
          {aperte.length > 0 ? (
            <div className="-mx-2">
              {aperte.slice(0, MAX_TASK).map((t) => (
                <TaskRow key={t.id} task={t} opzioni={{ senzaProgetto: true, senzaCliente: true }} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Nessuna task aperta.</p>
          )}
          {aperte.length > MAX_TASK && (
            <Link href={`/task/progetti/${id}`} className="text-sm text-primary hover:underline">
              Altre {aperte.length - MAX_TASK} task
            </Link>
          )}
          <AggiuntaRapida
            defaults={{ ambito: progetto.ambito ?? "lavoro", progetto_id: id }}
            placeholder="Aggiungi una task al progetto"
          />
        </section>
      </div>

      <ProgettoDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        progettoId={id}
        defaultValues={{
          nome: progetto.nome ?? "",
          ambito: progetto.ambito ?? "lavoro",
          cliente_id: progetto.cliente_id ?? "",
          stato: progetto.stato ?? "attivo",
          scadenza: progetto.scadenza ?? "",
          colore: progetto.colore ?? "",
          descrizione: progetto.descrizione ?? "",
        }}
      />
    </div>
  );
}
