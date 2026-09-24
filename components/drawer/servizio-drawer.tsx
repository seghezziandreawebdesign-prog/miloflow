"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Archive,
  Ban,
  Copy,
  ExternalLink,
  ListPlus,
  Mail,
  MoreHorizontal,
  Pencil,
  RefreshCw,
  RotateCcw,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { ClienteLogo } from "@/components/clienti/cliente-logo";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { AVVISO_ELIMINA_SERVIZIO } from "@/components/servizi/elimina-servizio";
import { CredenzialiSection } from "@/components/credenziali/credenziali-section";
import { AvvisaClienteDialog } from "@/components/servizi/avvisa-cliente-dialog";
import { RinnovaDialog } from "@/components/servizi/rinnova-dialog";
import { ServizioDialog } from "@/components/servizi/servizio-dialog";
import { servizioToForm } from "@/components/servizi/servizio-values";
import { StatoScadenzaBadge } from "@/components/servizi/stato-scadenza-badge";
import { useNuovaTask } from "@/components/task/nuova-task";
import { TipoIcona } from "@/components/tipo-icona";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PannelloDescription, PannelloHeader, PannelloTitle } from "@/components/drawer/pannello";
import { Skeleton } from "@/components/ui/skeleton";
import { deleteServizio, duplicaServizio, setStatoServizio } from "@/lib/actions/servizi";
import { nomeCliente } from "@/lib/clienti";
import { etichettaMetodo } from "@/lib/metodi-pagamento";
import { formatCurrency, formatDate } from "@/lib/dates/format";
import { APRI_PARAM, formatApri } from "@/lib/entita";
import { CHI_PAGA, costoAnnuo, frequenza, type StatoScadenza } from "@/lib/servizi";
import { createClient } from "@/lib/supabase/client";

import { useApriEntita } from "./use-apri-entita";
import { cn } from "@/lib/utils";

async function carica(id: string) {
  const supabase = createClient();
  const [servizio, links, prezzi, rinnovi, budget, owner] = await Promise.all([
    supabase.from("v_servizi").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("servizi_clienti")
      .select("cliente_id, clienti(id, nome_breve, ragione_sociale, logo_path, colore, sito)")
      .eq("servizio_id", id),
    supabase.from("servizi_clienti_economico").select("cliente_id, prezzo_rivendita").eq("servizio_id", id),
    supabase.from("servizi_rinnovi").select("id, data, importo, movimento_id").eq("servizio_id", id).order("data", { ascending: false }).limit(20),
    supabase.rpc("puo", { p_sezione: "budget" }),
    supabase.rpc("is_owner"),
  ]);
  if (servizio.error) throw servizio.error;
  if (!servizio.data) return null;

  const paths = (links.data ?? []).flatMap((l) => (l.clienti?.logo_path ? [l.clienti.logo_path] : []));
  const signed = paths.length ? ((await supabase.storage.from("loghi").createSignedUrls(paths, 3600)).data ?? []) : [];
  const url = new Map(signed.flatMap((s) => (s.path && s.signedUrl ? [[s.path, s.signedUrl] as const] : [])));
  const prezzo = new Map((prezzi.data ?? []).map((p) => [p.cliente_id, p.prezzo_rivendita]));

  return {
    servizio: servizio.data,
    clienti: (links.data ?? []).flatMap((l) =>
      l.clienti
        ? [
            {
              id: l.clienti.id,
              nome: nomeCliente(l.clienti),
              colore: l.clienti.colore,
              sito: l.clienti.sito,
              logo_url: l.clienti.logo_path ? (url.get(l.clienti.logo_path) ?? null) : null,
              prezzo_rivendita: prezzo.get(l.clienti.id) ?? null,
            },
          ]
        : [],
    ),
    rinnovi: rinnovi.data ?? [],
    puoBudget: budget.data === true,
    isOwner: owner.data === true,
  };
}

export function ServizioDrawer({ id }: { id: string }) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { data, isPending, isError } = useQuery({ queryKey: ["servizio", id], queryFn: () => carica(id) });
  const apri = useApriEntita();
  const [editOpen, setEditOpen] = useState(false);
  const [rinnovaOpen, setRinnovaOpen] = useState(false);
  const [avvisaOpen, setAvvisaOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [, startTransition] = useTransition();
  const nuovaTask = useNuovaTask();

  function aggiorna() {
    void queryClient.invalidateQueries({ queryKey: ["servizio", id] });
    router.refresh();
  }

  function apriAltro(nuovoId: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set(APRI_PARAM, formatApri({ tipo: "servizio", id: nuovoId }));
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
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
  if (isError || !data) {
    return (
      <PannelloHeader>
        <PannelloTitle>Servizio non trovato</PannelloTitle>
        <PannelloDescription>Potrebbe essere stato eliminato, oppure non hai accesso.</PannelloDescription>
      </PannelloHeader>
    );
  }

  const { servizio: s, clienti, rinnovi, puoBudget, isOwner } = data;
  const freq = frequenza(s.frequenza ?? "annuale");
  const attivo = s.stato === "attivo";

  function cambiaStato(stato: "attivo" | "disdetto" | "archiviato", messaggio: string) {
    startTransition(async () => {
      const result = await setStatoServizio(id, stato);
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
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <TipoIcona nome={s.tipo_icona} className="size-4" />
          {s.tipo_nome ?? "Servizio"}
          {s.ambito === "personale" && (
            <span className="rounded-full bg-ambito-personale-soft px-2 py-0.5 text-xs text-ambito-personale">Personale</span>
          )}
        </div>
        <PannelloTitle className="text-lg">{s.nome}</PannelloTitle>
        <PannelloDescription className="flex flex-wrap items-center gap-2">
          {attivo ? (
            <StatoScadenzaBadge stato={s.stato_scadenza as StatoScadenza} giorni={s.giorni_alla_scadenza ?? 0} />
          ) : (
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs capitalize">{s.stato}</span>
          )}
          <span>
            {freq.value === "una_tantum" ? "Scadenza" : "Prossima scadenza"} {formatDate(s.prossima_scadenza ?? "")}
          </span>
        </PannelloDescription>
      </PannelloHeader>

      <div className="flex flex-wrap gap-2 px-4 sm:px-5">
        {freq.mesi && (
          <Button onClick={() => setRinnovaOpen(true)}>
            <RefreshCw />
            Segna come rinnovato
          </Button>
        )}
        {s.url_pannello && (
          <a
            href={s.url_pannello}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonVariants({ variant: "outline" })}
          >
            <ExternalLink />
            Apri pannello
          </a>
        )}
        <Button variant="outline" size="icon" onClick={() => setEditOpen(true)} aria-label="Modifica">
          <Pencil />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="outline" size="icon" aria-label="Altre azioni" />}>
            <MoreHorizontal />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {clienti.length > 0 && (
              <DropdownMenuItem onClick={() => setAvvisaOpen(true)}>
                <Mail />
                Avvisa cliente
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              onClick={() =>
                nuovaTask({
                  titolo: `Rinnovare ${s.nome}`,
                  servizio_id: id,
                  ambito: s.ambito ?? "lavoro",
                  scadenza: s.prossima_scadenza ?? "",
                  // Con più clienti collegati si sceglie nel dialog.
                  cliente_id: clienti.length === 1 ? clienti[0].id : "",
                })
              }
            >
              <ListPlus />
              Crea task
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() =>
                startTransition(async () => {
                  const result = await duplicaServizio(id);
                  if (!result.ok) toast.error(result.error);
                  else {
                    toast.success("Servizio duplicato");
                    router.refresh();
                    apriAltro((result.data as { id: string }).id);
                  }
                })
              }
            >
              <Copy />
              Duplica
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {attivo ? (
              <DropdownMenuItem onClick={() => cambiaStato("disdetto", "Servizio disdetto: esce dalle scadenze attive")}>
                <Ban />
                Disdici
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onClick={() => cambiaStato("attivo", "Servizio riattivato")}>
                <RotateCcw />
                Riattiva
              </DropdownMenuItem>
            )}
            {s.stato !== "archiviato" && (
              <DropdownMenuItem onClick={() => cambiaStato("archiviato", "Servizio archiviato")}>
                <Archive />
                Archivia
              </DropdownMenuItem>
            )}
            {isOwner && (
              <DropdownMenuItem variant="destructive" onClick={() => setDeleteOpen(true)}>
                <Trash2 />
                Elimina
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="space-y-6 p-4 sm:p-5">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          {puoBudget && (
            <Dato label="Costo">
              {s.costo === null ? "—" : `${formatCurrency(s.costo)} · ${freq.label.toLowerCase()}`}
              {s.costo !== null && freq.mesi && freq.mesi !== 12 && (
                <span className="block text-xs text-muted-foreground">{formatCurrency(costoAnnuo(s.costo, freq.value))} l&apos;anno</span>
              )}
            </Dato>
          )}
          {!puoBudget && <Dato label="Frequenza">{freq.label}</Dato>}
          <Dato label="Chi paga">{CHI_PAGA.find((c) => c.value === s.chi_paga)?.label ?? "—"}</Dato>
          <Dato label="Rinnovo automatico">{s.rinnovo_automatico ? "Sì" : "No"}</Dato>
          <Dato label="Preavviso">{s.preavviso_effettivo} giorni</Dato>
          <Dato label="Fornitore">{s.fornitore ?? "—"}</Dato>
          {puoBudget && s.chi_paga === "io" && (
            <Dato label="Metodo di pagamento">
              {s.metodo_pagamento_nome
                ? etichettaMetodo({ nome: s.metodo_pagamento_nome, ultime_cifre: s.metodo_pagamento_cifre })
                : "—"}
            </Dato>
          )}
        </dl>

        <section className="space-y-2">
          <h3 className="text-sm font-medium">Clienti</h3>
          {clienti.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nessun cliente collegato.</p>
          ) : (
            <ul className="space-y-1.5">
              {clienti.map((c) => {
                const margine = c.prezzo_rivendita !== null && s.costo !== null ? c.prezzo_rivendita - s.costo : null;
                return (
                  <li key={c.id} className="flex items-center gap-2.5 text-sm">
                    <ClienteLogo nome={c.nome} colore={c.colore} logoUrl={c.logo_url} sito={c.sito} size="sm" />
                    <Link href={`/clienti/${c.id}`} className="min-w-0 flex-1 truncate hover:underline">
                      {c.nome}
                    </Link>
                    {puoBudget && c.prezzo_rivendita !== null && (
                      <span className="text-right tabular-nums">
                        {formatCurrency(c.prezzo_rivendita)}
                        {margine !== null && (
                          <span className={cn("block text-xs", margine >= 0 ? "text-emerald-700" : "text-red-700")}>
                            {margine >= 0 ? "+" : ""}
                            {formatCurrency(margine)}
                          </span>
                        )}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <CredenzialiSection proprietario={{ servizio_id: id }} username={s.username} />

        {s.note && (
          <section className="space-y-1">
            <h3 className="text-sm font-medium">Note</h3>
            <p className="text-sm whitespace-pre-wrap">{s.note}</p>
          </section>
        )}

        {puoBudget && (
          <section className="space-y-2">
            <h3 className="text-sm font-medium">Storico rinnovi</h3>
            {rinnovi.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nessun rinnovo registrato.</p>
            ) : (
              <ul className="divide-y text-sm">
                {rinnovi.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-2 py-1.5">
                    <span>{formatDate(r.data)}</span>
                    <span className="flex items-center gap-2">
                      {r.movimento_id && (
                        <button type="button" className="text-xs text-primary hover:underline" onClick={() => apri({ tipo: "movimento", id: r.movimento_id! })}>
                          nel budget
                        </button>
                      )}
                      <span className="tabular-nums">{r.importo === null ? "—" : formatCurrency(r.importo)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </div>

      <ServizioDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        servizioId={id}
        defaultValues={servizioToForm(s, clienti)}
        onSaved={aggiorna}
      />
      {s.prossima_scadenza && s.frequenza && (
        <RinnovaDialog
          key={s.prossima_scadenza}
          open={rinnovaOpen}
          onOpenChange={setRinnovaOpen}
          servizio={{ id, nome: s.nome ?? "", prossima_scadenza: s.prossima_scadenza, frequenza: s.frequenza, costo: s.costo }}
          mostraImporto={puoBudget}
          onRinnovato={aggiorna}
        />
      )}
      {clienti.length > 0 && (
        <AvvisaClienteDialog
          open={avvisaOpen}
          onOpenChange={setAvvisaOpen}
          servizio={{ id, nome: s.nome ?? "", prossima_scadenza: s.prossima_scadenza ?? "" }}
          clienti={clienti.map((c) => ({ id: c.id, nome: c.nome }))}
        />
      )}
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Eliminare "${s.nome}"?`}
        description={AVVISO_ELIMINA_SERVIZIO}
        onConfirm={async () => {
          const result = await deleteServizio(id);
          if (!result.ok) {
            toast.error(result.error);
            return false;
          }
          toast.success("Servizio eliminato");
          const params = new URLSearchParams(searchParams.toString());
          params.delete(APRI_PARAM);
          router.replace(params.toString() ? `${pathname}?${params}` : pathname);
          router.refresh();
        }}
      />
    </div>
  );
}

function Dato({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
