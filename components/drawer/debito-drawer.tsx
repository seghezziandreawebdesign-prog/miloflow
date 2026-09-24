"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Landmark, MoreHorizontal, Pencil, Trash2, Undo2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Line, LineChart, XAxis, YAxis } from "recharts";
import { toast } from "sonner";

import { chiaviBudget, invalidaBudget } from "@/components/budget/dati";
import { DebitoDialog } from "@/components/budget/debito-dialog";
import { PagamentoDialog } from "@/components/budget/pagamento-dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { PannelloDescription, PannelloHeader, PannelloTitle } from "@/components/drawer/pannello";
import { Button } from "@/components/ui/button";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { annullaPagamentoRata, deleteDebito, pagaRata } from "@/lib/actions/budget";
import { andamentoResiduo, nomeCategoria, statoDebito, tipoDebito } from "@/lib/budget";
import { formatCurrency, formatDate, todayISO } from "@/lib/dates/format";
import type { DebitoFormValues } from "@/lib/schemas/budget";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

import { useApriEntita, useChiudiEntita } from "./use-apri-entita";

async function carica(id: string) {
  const supabase = createClient();
  const [debito, categorie, scrittura] = await Promise.all([
    supabase
      .from("debiti")
      .select("*, debiti_rate(id, numero, scadenza, importo, pagata, movimento_id)")
      .eq("id", id)
      .order("numero", { referencedTable: "debiti_rate" })
      .maybeSingle(),
    supabase.from("categorie").select("id, nome, parent_id, ambito, colore, icona, budget_default, ordine, archiviata"),
    supabase.rpc("puo", { p_sezione: "budget", p_livello: "scrittura" }),
  ]);
  if (debito.error) throw debito.error;
  if (!debito.data) return null;
  return { ...debito.data, categorie: categorie.data ?? [], puoScrivere: scrittura.data === true };
}

export function DebitoDrawer({ id }: { id: string }) {
  const { data: d, isPending, isError } = useQuery({ queryKey: chiaviBudget.debito(id), queryFn: () => carica(id) });
  const queryClient = useQueryClient();
  const router = useRouter();
  const apri = useApriEntita();
  const chiudi = useChiudiEntita();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [rataDaPagare, setRataDaPagare] = useState<{ id: string; numero: number; importo: number } | null>(null);
  const [pending, startTransition] = useTransition();
  const oggi = todayISO();

  if (isPending) {
    return (
      <div className="space-y-3 p-4">
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }
  if (isError || !d) {
    return (
      <PannelloHeader>
        <PannelloTitle>Debito non trovato</PannelloTitle>
        <PannelloDescription>Potrebbe essere stato eliminato, oppure non hai accesso.</PannelloDescription>
      </PannelloHeader>
    );
  }

  const stato = statoDebito(d, d.debiti_rate, oggi);
  const andamento = andamentoResiduo(d, d.debiti_rate);
  const rate = [...d.debiti_rate].sort((a, b) => a.numero - b.numero);
  const categoria = nomeCategoria(d.categoria_id, d.categorie);
  const ratePagate = rate.filter((r) => r.pagata).map((r) => r.numero);

  function aggiorna() {
    invalidaBudget(queryClient);
    void queryClient.invalidateQueries({ queryKey: chiaviBudget.debito(id) });
    router.refresh();
  }

  function annulla(rataId: string) {
    startTransition(async () => {
      const result = await annullaPagamentoRata(rataId);
      if (!result.ok) toast.error(result.error);
      else {
        toast.success("Pagamento annullato");
        aggiorna();
      }
    });
  }

  const valoriForm: DebitoFormValues = {
    ambito: d.ambito,
    creditore: d.creditore,
    descrizione: d.descrizione ?? "",
    importo_totale: String(d.importo_totale).replace(".", ","),
    tipo: d.tipo,
    data_inizio: d.data_inizio ?? "",
    categoria_id: d.categoria_id ?? "",
    note: d.note ?? "",
    rate: rate.map((r) => ({ numero: r.numero, scadenza: r.scadenza, importo: String(r.importo).replace(".", ",") })),
  };

  return (
    <div className="flex flex-col">
      <PannelloHeader className="gap-2 pr-12 sm:pr-14">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Landmark className="size-4" />
          Debito · {tipoDebito(d.tipo).label}
          {d.ambito === "personale" ? (
            <span className="rounded-full bg-ambito-personale-soft px-2 py-0.5 text-xs text-ambito-personale">Personale</span>
          ) : (
            <span className="rounded-full bg-ambito-lavoro-soft px-2 py-0.5 text-xs text-ambito-lavoro">Lavoro</span>
          )}
        </div>
        <PannelloTitle>{d.creditore}</PannelloTitle>
        <PannelloDescription>
          {d.descrizione && `${d.descrizione} · `}
          Totale {formatCurrency(d.importo_totale)}
          {categoria && ` · ${categoria}`}
        </PannelloDescription>
      </PannelloHeader>

      {d.puoScrivere && (
        <div className="flex flex-wrap gap-2 px-4 sm:px-5">
          {stato.prossima && (
            <Button
              onClick={() => {
                const r = rate.find((x) => x.numero === stato.prossima!.numero);
                if (r) setRataDaPagare({ id: r.id, numero: r.numero, importo: r.importo });
              }}
            >
              <Check />
              Paga rata {stato.prossima.numero}
            </Button>
          )}
          <Button variant={stato.prossima ? "outline" : "default"} onClick={() => setEditOpen(true)}>
            <Pencil />
            Modifica
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" size="icon" aria-label="Altre azioni" />}>
              <MoreHorizontal />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem variant="destructive" onClick={() => setDeleteOpen(true)} disabled={ratePagate.length > 0}>
                <Trash2 />
                Elimina
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      <div className="space-y-5 p-4 sm:p-5">
        <div>
          <div className="flex items-baseline justify-between text-sm">
            <span>
              <span className="text-2xl font-semibold tabular-nums tracking-tight">{formatCurrency(stato.residuo)}</span>
              <span className="text-muted-foreground"> residuo</span>
            </span>
            <span className="text-muted-foreground tabular-nums">{formatCurrency(stato.pagato)} pagati</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary" style={{ width: `${stato.avanzamento}%` }} />
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">
            {stato.rateTotali > 0 ? `${stato.ratePagate} rate pagate su ${stato.rateTotali}` : "Nessun piano di rate"}
            {stato.inRitardo > 0 && <span className="ml-1.5 font-medium text-destructive">{stato.inRitardo} in ritardo</span>}
            {d.data_inizio && ` · dal ${formatDate(d.data_inizio)}`}
          </p>
        </div>

        {andamento.length > 1 && (
          <section>
            <h3 className="mb-1 text-sm font-medium">Residuo nel tempo</h3>
            <ChartContainer config={{ residuo: { label: "Residuo", color: "var(--primary)" } }} className="h-36 w-full">
              <LineChart data={andamento} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                <XAxis dataKey="scadenza" tickLine={false} axisLine={false} tickFormatter={(v: string) => formatDate(v).slice(3)} fontSize={11} interval="preserveStartEnd" />
                <YAxis tickLine={false} axisLine={false} width={44} fontSize={11} tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 100) / 10}k` : String(v))} />
                <ChartTooltip content={<ChartTooltipContent labelFormatter={(v) => formatDate(String(v))} formatter={(v) => [formatCurrency(Number(v)), "Residuo"]} />} />
                <Line dataKey="residuo" type="monotone" stroke="var(--primary)" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
              </LineChart>
            </ChartContainer>
          </section>
        )}

        {rate.length > 0 && (
          <section>
            <h3 className="mb-1.5 text-sm font-medium">Piano delle rate</h3>
            <ul className="divide-y rounded-lg ring-1 ring-black/8">
              {rate.map((r) => {
                const inRitardo = !r.pagata && r.scadenza < oggi;
                return (
                  <li key={r.id} className={cn("flex items-center gap-3 px-3 py-2 text-sm", r.pagata && "text-muted-foreground")}>
                    <span className={cn("grid size-6 shrink-0 place-items-center rounded-full text-xs", r.pagata ? "bg-scadenza-ok/15 text-scadenza-ok" : "bg-muted")}>
                      {r.pagata ? <Check className="size-3.5" /> : r.numero}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={cn(inRitardo && "font-medium text-destructive")}>{formatDate(r.scadenza)}</span>
                      {r.pagata && r.movimento_id && (
                        <button type="button" className="ml-2 text-xs text-primary hover:underline" onClick={() => apri({ tipo: "movimento", id: r.movimento_id! })}>
                          vedi movimento
                        </button>
                      )}
                      {inRitardo && <span className="ml-2 text-xs text-destructive">in ritardo</span>}
                    </span>
                    <span className="tabular-nums">{formatCurrency(r.importo)}</span>
                    {d.puoScrivere &&
                      (r.pagata ? (
                        <Button variant="ghost" size="icon-xs" aria-label={`Annulla il pagamento della rata ${r.numero}`} onClick={() => annulla(r.id)} disabled={pending}>
                          <Undo2 />
                        </Button>
                      ) : (
                        <Button variant="outline" size="sm" onClick={() => setRataDaPagare({ id: r.id, numero: r.numero, importo: r.importo })}>
                          Paga
                        </Button>
                      ))}
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {d.note && <p className="text-sm whitespace-pre-wrap">{d.note}</p>}
        <p className="text-xs text-muted-foreground">Creato il {formatDate(d.created_at)}</p>
      </div>

      {editOpen && (
        <DebitoDialog open onOpenChange={(o) => !o && setEditOpen(false)} debitoId={id} defaultValues={valoriForm} ratePagate={ratePagate} onSaved={aggiorna} />
      )}
      {rataDaPagare && (
        <PagamentoDialog
          open
          onOpenChange={(o) => !o && setRataDaPagare(null)}
          titolo={`Paga la rata ${rataDaPagare.numero}`}
          descrizione={d.creditore}
          importo={rataDaPagare.importo}
          ambito={d.ambito}
          onConferma={(v) => pagaRata(rataDaPagare.id, v)}
          onFatto={aggiorna}
        />
      )}
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Eliminare il debito?"
        description="Verranno eliminate anche le rate e i previsti collegati. L'operazione non si può annullare."
        onConfirm={async () => {
          const result = await deleteDebito(id);
          if (!result.ok) {
            toast.error(result.error);
            return false;
          }
          toast.success("Debito eliminato");
          invalidaBudget(queryClient);
          chiudi();
          router.refresh();
        }}
      />
    </div>
  );
}
