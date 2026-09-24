"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, CalendarDays, Clock, ExternalLink, FolderKanban, MapPin, MoreHorizontal, Pencil, Repeat, Trash2 } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { invalidaCalendario } from "@/components/calendario/dati";
import { EventoDialog } from "@/components/calendario/evento-dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { PannelloDescription, PannelloHeader, PannelloTitle } from "@/components/drawer/pannello";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { deleteEvento } from "@/lib/actions/eventi";
import { nomeCliente } from "@/lib/clienti";
import { capitalize, formatDate, formatLongDate, formatTime, localDateTime } from "@/lib/dates/format";
import { addDays } from "@/lib/dates/giorni";
import { descriviRicorrenza } from "@/lib/dates/ricorrenza";
import { APRI_PARAM } from "@/lib/entita";
import { eventoToForm } from "@/lib/schemas/eventi";
import { createClient } from "@/lib/supabase/client";

import { useApriEntita } from "./use-apri-entita";

async function carica(id: string) {
  const { data, error } = await createClient()
    .from("eventi")
    .select("*, clienti(id, nome_breve, ragione_sociale), progetti(id, nome, colore)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** "giovedì 24 settembre, 09:30–10:30" oppure "dal 22 al 26 settembre". */
function descriviQuando(e: { inizio: string; fine: string | null; tutto_il_giorno: boolean }): string {
  const inizio = localDateTime(e.inizio);
  const giornoInizio = inizio.slice(0, 10);
  if (e.tutto_il_giorno) {
    // La fine salvata è esclusiva.
    const giornoFine = e.fine ? addDays(localDateTime(e.fine).slice(0, 10), -1) : giornoInizio;
    if (giornoFine <= giornoInizio) return `${capitalize(formatLongDate(giornoInizio))} · tutto il giorno`;
    return `Dal ${formatDate(giornoInizio)} al ${formatDate(giornoFine)}`;
  }
  const fine = e.fine ? localDateTime(e.fine) : null;
  const ore = fine && fine.slice(0, 10) === giornoInizio ? `${inizio.slice(11)}–${fine.slice(11)}` : inizio.slice(11);
  if (fine && fine.slice(0, 10) !== giornoInizio) {
    return `${formatDate(giornoInizio)} ${inizio.slice(11)} → ${formatDate(fine.slice(0, 10))} ${fine.slice(11)}`;
  }
  return `${capitalize(formatLongDate(giornoInizio))}, ${ore}`;
}

export function EventoDrawer({ id }: { id: string }) {
  const { data: e, isPending, isError } = useQuery({ queryKey: ["evento", id], queryFn: () => carica(id) });
  const queryClient = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const apri = useApriEntita();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  if (isPending) {
    return (
      <div className="space-y-3 p-4">
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }
  if (isError || !e) {
    return (
      <PannelloHeader>
        <PannelloTitle>Evento non trovato</PannelloTitle>
        <PannelloDescription>Potrebbe essere stato eliminato, oppure non hai accesso.</PannelloDescription>
      </PannelloHeader>
    );
  }

  const ricorrenza = descriviRicorrenza(e.ricorrenza);

  function chiudi() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete(APRI_PARAM);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  return (
    <div className="flex flex-col">
      <PannelloHeader className="gap-2 pr-12 sm:pr-14">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <CalendarDays className="size-4" />
          Evento
          {e.ambito === "personale" ? (
            <span className="rounded-full bg-ambito-personale-soft px-2 py-0.5 text-xs text-ambito-personale">Personale</span>
          ) : (
            <span className="rounded-full bg-ambito-lavoro-soft px-2 py-0.5 text-xs text-ambito-lavoro">Lavoro</span>
          )}
        </div>
        <PannelloTitle>{e.titolo}</PannelloTitle>
        <PannelloDescription className="flex items-center gap-1.5">
          <Clock className="size-3.5" />
          {descriviQuando(e)}
        </PannelloDescription>
      </PannelloHeader>

      <div className="flex flex-wrap gap-2 px-4 sm:px-5">
        {e.link_call && (
          <a href={e.link_call} target="_blank" rel="noopener noreferrer" className={buttonVariants()}>
            <ExternalLink />
            Apri la call
          </a>
        )}
        <Button variant={e.link_call ? "outline" : "default"} onClick={() => setEditOpen(true)}>
          <Pencil />
          Modifica
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="outline" size="icon" aria-label="Altre azioni" />}>
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

      <div className="space-y-4 p-4 sm:p-5">
        <dl className="space-y-2 text-sm">
          {ricorrenza && (
            <Voce icona={Repeat} label="Si ripete">
              {ricorrenza}
              {e.fine && !e.tutto_il_giorno && ` · dalle ${formatTime(e.inizio)} alle ${formatTime(e.fine)}`}
            </Voce>
          )}
          {e.luogo && (
            <Voce icona={MapPin} label="Luogo">
              {e.luogo}
            </Voce>
          )}
          {e.progetti && (
            <Voce icona={FolderKanban} label="Progetto">
              <button type="button" className="text-primary hover:underline" onClick={() => apri({ tipo: "progetto", id: e.progetti!.id })}>
                {e.progetti.nome}
              </button>
            </Voce>
          )}
          {e.clienti && (
            <Voce icona={Building2} label="Cliente">
              <button type="button" className="text-primary hover:underline" onClick={() => apri({ tipo: "cliente", id: e.clienti!.id })}>
                {nomeCliente(e.clienti)}
              </button>
            </Voce>
          )}
        </dl>
        {e.note && <p className="text-sm whitespace-pre-wrap">{e.note}</p>}
        <p className="text-xs text-muted-foreground">Creato il {formatDate(e.created_at)}</p>
      </div>

      <EventoDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        eventoId={id}
        defaultValues={eventoToForm(e)}
        onSaved={() => void queryClient.invalidateQueries({ queryKey: ["evento", id] })}
      />
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Eliminare l'evento?"
        description={e.ricorrenza ? "Verranno eliminate tutte le occorrenze. L'operazione non si può annullare." : "L'operazione non si può annullare."}
        onConfirm={async () => {
          const result = await deleteEvento(id);
          if (!result.ok) {
            toast.error(result.error);
            return false;
          }
          toast.success("Evento eliminato");
          invalidaCalendario(queryClient);
          chiudi();
          router.refresh();
        }}
      />
    </div>
  );
}

function Voce({ icona: Icona, label, children }: { icona: typeof MapPin; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5">
      <Icona className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd>{children}</dd>
      </div>
    </div>
  );
}
