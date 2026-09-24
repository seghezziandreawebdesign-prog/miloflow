"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, Landmark, MoreHorizontal, Paperclip, Pencil, ReceiptEuro, RefreshCw, Trash2, Undo2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { CategoriaIcona } from "@/components/budget/categoria-icona";
import { chiaviBudget, invalidaBudget } from "@/components/budget/dati";
import { BUCKET_RICEVUTE, MovimentoDialog } from "@/components/budget/nuova-spesa";
import { PagamentoDialog } from "@/components/budget/pagamento-dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { PannelloDescription, PannelloHeader, PannelloTitle } from "@/components/drawer/pannello";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { deleteMovimento, segnaPagato, segnaPrevisto, setRicevuta } from "@/lib/actions/budget";
import { nomeFileSicuro, nomeVisibile } from "@/lib/allegati";
import { etichettaCategoriaMovimento } from "@/lib/budget";
import { capitalize, formatCurrency, formatDate, formatLongDate } from "@/lib/dates/format";
import { createClient } from "@/lib/supabase/client";

import { useApriEntita, useChiudiEntita } from "./use-apri-entita";

async function carica(id: string) {
  const supabase = createClient();
  const { data, error } = await supabase.from("v_movimenti").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  let ricevutaUrl: string | null = null;
  if (data.ricevuta_path) {
    const { data: firmato } = await supabase.storage.from(BUCKET_RICEVUTE).createSignedUrl(data.ricevuta_path, 600);
    ricevutaUrl = firmato?.signedUrl ?? null;
  }
  const [scrittura] = await Promise.all([supabase.rpc("puo", { p_sezione: "budget", p_livello: "scrittura" })]);
  return { ...data, ricevutaUrl, puoScrivere: scrittura.data === true };
}

export function MovimentoDrawer({ id }: { id: string }) {
  const { data: m, isPending, isError } = useQuery({ queryKey: chiaviBudget.movimento(id), queryFn: () => carica(id) });
  const queryClient = useQueryClient();
  const router = useRouter();
  const apri = useApriEntita();
  const chiudi = useChiudiEntita();
  const [editOpen, setEditOpen] = useState(false);
  const [pagaOpen, setPagaOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);

  if (isPending) {
    return (
      <div className="space-y-3 p-4">
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }
  if (isError || !m) {
    return (
      <PannelloHeader>
        <PannelloTitle>Movimento non trovato</PannelloTitle>
        <PannelloDescription>Potrebbe essere stato eliminato, oppure non hai accesso.</PannelloDescription>
      </PannelloHeader>
    );
  }

  const previsto = m.stato === "previsto";
  const generato = Boolean(m.servizio_id || m.rata_id);
  const categoria = etichettaCategoriaMovimento(m);

  function aggiorna() {
    invalidaBudget(queryClient);
    void queryClient.invalidateQueries({ queryKey: chiaviBudget.movimento(id) });
    router.refresh();
  }

  function riportaPrevisto() {
    startTransition(async () => {
      const result = await segnaPrevisto(id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Riportato a previsto");
      aggiorna();
    });
  }

  function caricaRicevuta(file: File) {
    startTransition(async () => {
      const path = `${id}/${nomeFileSicuro(file.name)}`;
      const { error } = await createClient().storage.from(BUCKET_RICEVUTE).upload(path, file, { contentType: file.type || undefined });
      if (error) {
        toast.error(`Ricevuta non caricata: ${error.message}`);
        return;
      }
      const result = await setRicevuta(id, path);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Ricevuta caricata");
      aggiorna();
    });
  }

  function togliRicevuta() {
    startTransition(async () => {
      if (m?.ricevuta_path) await createClient().storage.from(BUCKET_RICEVUTE).remove([m.ricevuta_path]);
      const result = await setRicevuta(id, null);
      if (!result.ok) toast.error(result.error);
      else aggiorna();
    });
  }

  return (
    <div className="flex flex-col">
      <PannelloHeader className="gap-2 pr-12 sm:pr-14">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <ReceiptEuro className="size-4" />
          {previsto ? "Spesa prevista" : "Movimento"}
          {m.ambito === "personale" ? (
            <span className="rounded-full bg-ambito-personale-soft px-2 py-0.5 text-xs text-ambito-personale">Personale</span>
          ) : (
            <span className="rounded-full bg-ambito-lavoro-soft px-2 py-0.5 text-xs text-ambito-lavoro">Lavoro</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <CategoriaIcona nome={m.categoria_icona} colore={m.categoria_colore} size="lg" />
          <div className="min-w-0">
            <PannelloTitle className="truncate">{m.descrizione || categoria || "Movimento"}</PannelloTitle>
            <PannelloDescription>
              <span className="text-lg font-semibold text-foreground tabular-nums">{formatCurrency(m.importo!)}</span>
              {" · "}
              {capitalize(formatLongDate(m.data!))}
            </PannelloDescription>
          </div>
        </div>
      </PannelloHeader>

      {m.puoScrivere && (
        <div className="flex flex-wrap gap-2 px-4 sm:px-5">
          {previsto ? (
            <Button onClick={() => setPagaOpen(true)}>Segna pagato</Button>
          ) : (
            <Button variant="outline" onClick={() => setEditOpen(true)}>
              <Pencil />
              Modifica
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" size="icon" aria-label="Altre azioni" />}>
              <MoreHorizontal />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              {previsto && (
                <DropdownMenuItem onClick={() => setEditOpen(true)}>
                  <Pencil />
                  Modifica
                </DropdownMenuItem>
              )}
              {!previsto && (
                <DropdownMenuItem onClick={riportaPrevisto} disabled={pending}>
                  <Undo2 />
                  {m.rata_id ? "Annulla il pagamento" : "Riporta a previsto"}
                </DropdownMenuItem>
              )}
              {!(m.rata_id && !previsto) && (
                <DropdownMenuItem variant="destructive" onClick={() => setDeleteOpen(true)}>
                  <Trash2 />
                  Elimina
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      <dl className="space-y-2 p-4 text-sm sm:p-5">
        <Voce label="Categoria">{categoria ?? <span className="text-muted-foreground">Nessuna</span>}</Voce>
        <Voce label="Stato">{previsto ? "Previsto, da pagare" : "Pagato"}</Voce>
        {m.metodo_nome && <Voce label="Pagato con">{m.metodo_cifre ? `${m.metodo_nome} •${m.metodo_cifre}` : m.metodo_nome}</Voce>}
        {m.servizio_id && (
          <Voce label="Servizio">
            <button type="button" className="inline-flex items-center gap-1 text-primary hover:underline" onClick={() => apri({ tipo: "servizio", id: m.servizio_id! })}>
              <RefreshCw className="size-3.5" />
              {m.servizio_nome}
            </button>
          </Voce>
        )}
        {m.debito_id && (
          <Voce label="Debito">
            <button type="button" className="inline-flex items-center gap-1 text-primary hover:underline" onClick={() => apri({ tipo: "debito", id: m.debito_id! })}>
              <Landmark className="size-3.5" />
              {m.debito_creditore} · rata {m.rata_numero}
            </button>
          </Voce>
        )}
        {m.periodo && generato && <Voce label="Periodo di competenza">{formatDate(m.periodo)}</Voce>}
        <Voce label="Ricevuta">
          {m.ricevuta_path && m.ricevutaUrl ? (
            <span className="flex flex-wrap items-center gap-2">
              <a href={m.ricevutaUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                <Paperclip className="size-3.5" />
                {nomeVisibile(m.ricevuta_path.split("/").pop() ?? "ricevuta")}
              </a>
              {m.puoScrivere && (
                <Button variant="ghost" size="icon-xs" aria-label="Togli la ricevuta" onClick={togliRicevuta} disabled={pending}>
                  <X />
                </Button>
              )}
            </span>
          ) : m.puoScrivere ? (
            <>
              <input
                ref={fileInput}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/heic,application/pdf"
                capture="environment"
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) caricaRicevuta(f);
                }}
              />
              <button type="button" className="inline-flex items-center gap-1 text-primary hover:underline" onClick={() => fileInput.current?.click()} disabled={pending}>
                <Camera className="size-3.5" />
                Aggiungi foto o file
              </button>
            </>
          ) : (
            <span className="text-muted-foreground">Nessuna</span>
          )}
        </Voce>
        {m.ricevutaUrl && /\.(png|jpe?g|webp)$/i.test(m.ricevuta_path ?? "") && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={m.ricevutaUrl} alt="Ricevuta" className="mt-2 max-h-72 rounded-lg ring-1 ring-black/8" />
        )}
        <p className="pt-2 text-xs text-muted-foreground">Creato il {formatDate(m.created_at!)}</p>
      </dl>

      {editOpen && (
        <MovimentoDialog
          open
          onOpenChange={(o) => !o && setEditOpen(false)}
          movimentoId={id}
          bloccato={generato}
          defaultValues={{
            ambito: m.ambito!,
            data: m.data!,
            importo: String(m.importo).replace(".", ","),
            descrizione: m.descrizione ?? "",
            categoria_id: m.categoria_id ?? "",
            stato: m.stato!,
            metodo_pagamento_id: m.metodo_pagamento_id ?? "",
          }}
          onSaved={aggiorna}
        />
      )}
      {pagaOpen && (
        <PagamentoDialog
          open
          onOpenChange={(o) => !o && setPagaOpen(false)}
          titolo="Segna pagato"
          descrizione={m.descrizione ?? undefined}
          importo={m.importo!}
          ambito={m.ambito!}
          metodoIniziale={m.metodo_pagamento_id ?? ""}
          onConferma={(v) => segnaPagato(id, v)}
          onFatto={aggiorna}
        />
      )}
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Eliminare il movimento?"
        description={generato ? "Il previsto tornerà al prossimo «Aggiorna previsti» se il servizio o la rata sono ancora validi." : "L'operazione non si può annullare."}
        onConfirm={async () => {
          const result = await deleteMovimento(id);
          if (!result.ok) {
            toast.error(result.error);
            return false;
          }
          toast.success("Movimento eliminato");
          invalidaBudget(queryClient);
          chiudi();
          router.refresh();
        }}
      />
    </div>
  );
}

function Voce({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[8rem_1fr] gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}
