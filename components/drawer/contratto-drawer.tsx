"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, MoreHorizontal, Pencil, RotateCcw, Trash2 } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { ClienteLogo } from "@/components/clienti/cliente-logo";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { ContrattoDialog } from "@/components/contratti/contratto-dialog";
import { contrattoToForm } from "@/components/contratti/contratto-values";
import { StatoContrattoBadge } from "@/components/contratti/stato-badge";
import { TipoIcona } from "@/components/tipo-icona";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PannelloDescription, PannelloHeader, PannelloTitle } from "@/components/drawer/pannello";
import { Skeleton } from "@/components/ui/skeleton";
import { deleteContratto, setStatoContratto } from "@/lib/actions/contratti";
import { formatCurrency, formatDate } from "@/lib/dates/format";
import { APRI_PARAM } from "@/lib/entita";
import { caricaContratti } from "@/lib/queries/contratti";
import { frequenza } from "@/lib/servizi";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

import { useApriEntita } from "./use-apri-entita";

async function carica(id: string) {
  const [contratto] = await caricaContratti(createClient(), { id });
  return contratto ?? null;
}

export function ContrattoDrawer({ id }: { id: string }) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { data: c, isPending, isError } = useQuery({ queryKey: ["contratto", id], queryFn: () => carica(id) });
  const apri = useApriEntita();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [, startTransition] = useTransition();

  function aggiorna() {
    void queryClient.invalidateQueries({ queryKey: ["contratto", id] });
    router.refresh();
  }

  if (isPending) {
    return (
      <div className="space-y-3 p-4">
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }
  if (isError || !c) {
    return (
      <PannelloHeader>
        <PannelloTitle>Contratto non trovato</PannelloTitle>
        <PannelloDescription>Potrebbe essere stato eliminato, oppure non hai accesso.</PannelloDescription>
      </PannelloHeader>
    );
  }

  const attivo = c.stato === "attivo";
  const costoMio = c.costo_annuo_mio;
  const margine = c.totale_annuo - costoMio;

  function cambiaStato(stato: "attivo" | "concluso", messaggio: string) {
    startTransition(async () => {
      const result = await setStatoContratto(id, stato);
      if (!result.ok) toast.error(result.error);
      else {
        toast.success(messaggio);
        aggiorna();
      }
    });
  }

  return (
    <div className="flex flex-col">
      <PannelloHeader className="gap-2 pr-12 sm:pr-14">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">Contratto</div>
        <div className="flex items-center gap-3">
          {c.cliente && (
            <ClienteLogo nome={c.cliente.nome} colore={c.cliente.colore} logoUrl={c.cliente.logo_url} sito={c.cliente.sito} />
          )}
          <div className="min-w-0">
            <PannelloTitle className="text-lg">
              {c.cliente ? (
                <Link href={`/clienti/${c.cliente.id}`} className="hover:underline">
                  {c.cliente.nome}
                </Link>
              ) : (
                "Cliente"
              )}
            </PannelloTitle>
            {c.titolo && <p className="truncate text-sm text-muted-foreground">{c.titolo}</p>}
          </div>
        </div>
        <PannelloDescription className="flex flex-wrap items-center gap-2">
          <StatoContrattoBadge stato={c.stato} />
          {(c.data_inizio || c.data_fine) && (
            <span>
              {c.data_inizio && `dal ${formatDate(c.data_inizio)}`}
              {c.data_inizio && c.data_fine && " "}
              {c.data_fine && `al ${formatDate(c.data_fine)}`}
            </span>
          )}
        </PannelloDescription>
      </PannelloHeader>

      <div className="flex flex-wrap gap-2 px-4 sm:px-5">
        <Button variant="outline" onClick={() => setEditOpen(true)}>
          <Pencil />
          Modifica
        </Button>
        {attivo ? (
          <Button variant="outline" onClick={() => cambiaStato("concluso", "Contratto concluso")}>
            <CheckCircle2 />
            Segna concluso
          </Button>
        ) : (
          <Button variant="outline" onClick={() => cambiaStato("attivo", "Contratto riattivato")}>
            <RotateCcw />
            Riapri
          </Button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="outline" size="icon" aria-label="Altre azioni" />}>
            <MoreHorizontal />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {c.cliente && (
              <DropdownMenuItem onClick={() => apri({ tipo: "cliente", id: c.cliente!.id })}>
                Apri il cliente
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={() => setDeleteOpen(true)}>
              <Trash2 />
              Elimina
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="space-y-6 p-4 sm:p-5">
        <section>
          {c.righe.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nessun servizio nel contratto.</p>
          ) : (
            <div className="overflow-hidden rounded-lg ring-1 ring-black/8">
              <div className="grid grid-cols-[1fr_auto] items-center gap-2 border-b bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground">
                <span>Servizio</span>
                <span className="text-right">Prezzo</span>
              </div>
              <ul className="divide-y divide-black/5">
                {c.righe.map((r) => {
                  const margineRiga = r.costo !== null ? r.prezzo - r.costo : null;
                  return (
                    <li key={r.id} className="grid grid-cols-[1fr_auto] items-center gap-2 px-3 py-2">
                      <button
                        type="button"
                        onClick={() => apri({ tipo: "servizio", id: r.servizio_id })}
                        className="flex min-w-0 items-center gap-2 text-left hover:underline"
                      >
                        <TipoIcona nome={r.tipo_icona} className="size-4 shrink-0 text-muted-foreground" />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium">{r.nome}</span>
                          <span className="block text-xs text-muted-foreground">
                            {frequenza(r.frequenza).label}
                            {r.stato_servizio !== "attivo" && ` · ${r.stato_servizio}`}
                          </span>
                        </span>
                      </button>
                      <span className="text-right text-sm">
                        <span className="font-medium tabular-nums">{formatCurrency(r.prezzo)}</span>
                        {margineRiga !== null && (
                          <span
                            className={cn(
                              "block text-xs tabular-nums",
                              margineRiga >= 0 ? "text-emerald-700" : "text-red-700",
                            )}
                          >
                            {margineRiga >= 0 ? "+" : ""}
                            {formatCurrency(margineRiga)}
                          </span>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
              <div className="space-y-0.5 border-t bg-muted/40 px-3 py-2 text-right">
                <p className="text-sm">
                  <span className="text-muted-foreground">Totale · </span>
                  <span className="font-semibold tabular-nums">{formatCurrency(c.totale_annuo)} l&apos;anno</span>
                  {c.totale_annuo > 0 && (
                    <span className="text-muted-foreground"> · ≈ {formatCurrency(c.totale_annuo / 12)} al mese</span>
                  )}
                </p>
                {c.una_tantum > 0 && (
                  <p className="text-xs text-muted-foreground">più {formatCurrency(c.una_tantum)} una tantum</p>
                )}
                {costoMio > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Mi costa {formatCurrency(costoMio)} l&apos;anno · margine{" "}
                    <span className={cn("tabular-nums", margine >= 0 ? "text-emerald-700" : "text-red-700")}>
                      {margine >= 0 ? "+" : ""}
                      {formatCurrency(margine)}
                    </span>
                  </p>
                )}
              </div>
            </div>
          )}
        </section>

        {c.note && (
          <section className="space-y-1">
            <h3 className="text-sm font-medium">Note</h3>
            <p className="text-sm whitespace-pre-wrap">{c.note}</p>
          </section>
        )}
      </div>

      <ContrattoDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        contrattoId={id}
        defaultValues={contrattoToForm(c)}
        onSaved={aggiorna}
      />
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Eliminare il contratto?"
        description="I servizi restano nel database: si elimina solo il contratto con i suoi prezzi."
        onConfirm={async () => {
          const result = await deleteContratto(id);
          if (!result.ok) {
            toast.error(result.error);
            return false;
          }
          toast.success("Contratto eliminato");
          const params = new URLSearchParams(searchParams.toString());
          params.delete(APRI_PARAM);
          router.replace(params.toString() ? `${pathname}?${params}` : pathname);
          router.refresh();
        }}
      />
    </div>
  );
}
