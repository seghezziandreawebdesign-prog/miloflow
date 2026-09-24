"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createElement, useState } from "react";
import { Archive, ArchiveRestore, ArrowDownToLine, LineChart as IconaGrafico, MoreHorizontal, Pencil, Plus, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { Line, LineChart, XAxis, YAxis } from "recharts";
import { toast } from "sonner";

import { chiaviBudget, invalidaBudget } from "@/components/budget/dati";
import { ImportoDataDialog } from "@/components/budget/importo-data-dialog";
import { PagamentoDialog } from "@/components/budget/pagamento-dialog";
import { SalvadanaioDialog } from "@/components/budget/salvadanaio-dialog";
import { Rendimento } from "@/components/budget/salvadanai-view";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { PannelloDescription, PannelloHeader, PannelloTitle } from "@/components/drawer/pannello";
import { Button } from "@/components/ui/button";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { segnaPagato } from "@/lib/actions/budget";
import {
  deletePrelievo,
  deleteSalvadanaio,
  deleteValore,
  prelevaSalvadanaio,
  saveValore,
  setSalvadanaioArchiviato,
  versaSalvadanaio,
} from "@/lib/actions/salvadanai";
import { formatCurrency, formatDate, todayISO } from "@/lib/dates/format";
import { icona } from "@/lib/icone";
import {
  avanzamentoObiettivo,
  normalizzaSalvadanaio,
  rendimento,
  ritmoObiettivo,
  serieInvestimento,
  TIPI_SALVADANAIO,
} from "@/lib/salvadanai";
import type { SalvadanaioFormValues } from "@/lib/schemas/salvadanai";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

import { useApriEntita, useChiudiEntita } from "./use-apri-entita";

const CONFIG_GRAFICO = {
  versato: { label: "Versato", color: "var(--muted-foreground)" },
  valore: { label: "Valore", color: "var(--primary)" },
} satisfies ChartConfig;

async function carica(id: string) {
  const supabase = createClient();
  const [salvadanaio, movimenti, prelievi, valori, scrittura] = await Promise.all([
    supabase.from("v_salvadanai").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("movimenti")
      .select("id, data, importo, stato, periodo")
      .eq("salvadanaio_id", id)
      .order("data", { ascending: false }),
    supabase.from("salvadanai_prelievi").select("id, data, importo, note").eq("salvadanaio_id", id).order("data", { ascending: false }),
    supabase.from("salvadanai_valori").select("id, data, valore, note").eq("salvadanaio_id", id).order("data", { ascending: false }),
    supabase.rpc("puo", { p_sezione: "budget", p_livello: "scrittura" }),
  ]);
  if (salvadanaio.error) throw salvadanaio.error;
  if (!salvadanaio.data) return null;
  return {
    s: normalizzaSalvadanaio(salvadanaio.data),
    versamenti: (movimenti.data ?? []).filter((m) => m.stato === "pagato"),
    prelievi: prelievi.data ?? [],
    valori: valori.data ?? [],
    puoScrivere: scrittura.data === true,
  };
}

type Conferma = { titolo: string; descrizione: string; azione: () => Promise<{ ok: true } | { ok: false; error: string }>; fatto: string };

export function SalvadanaioDrawer({ id }: { id: string }) {
  const { data, isPending, isError } = useQuery({ queryKey: chiaviBudget.salvadanaio(id), queryFn: () => carica(id) });
  const queryClient = useQueryClient();
  const router = useRouter();
  const apri = useApriEntita();
  const chiudi = useChiudiEntita();
  const [dialog, setDialog] = useState<"modifica" | "versa" | "previsto" | "preleva" | "valore" | null>(null);
  const [conferma, setConferma] = useState<Conferma | null>(null);
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
  if (isError || !data) {
    return (
      <PannelloHeader>
        <PannelloTitle>Non trovato</PannelloTitle>
        <PannelloDescription>Potrebbe essere stato eliminato, oppure non hai accesso.</PannelloDescription>
      </PannelloHeader>
    );
  }

  const { s, versamenti, prelievi, valori, puoScrivere } = data;
  const investimento = s.tipo === "investimento";
  const tipo = TIPI_SALVADANAIO[s.tipo];
  const colore = s.colore ?? "var(--primary)";
  const avanzamento = investimento ? null : avanzamentoObiettivo(s.saldo, s.obiettivo);
  const ritmo = investimento ? null : ritmoObiettivo(s, oggi);
  const r = investimento ? rendimento(s.saldo, s.valore_attuale) : null;
  const serie = investimento ? serieInvestimento(versamenti, prelievi, valori) : [];
  const conVersamenti = versamenti.length > 0 || prelievi.length > 0;

  function aggiorna() {
    invalidaBudget(queryClient);
    void queryClient.invalidateQueries({ queryKey: chiaviBudget.salvadanaio(id) });
    router.refresh();
  }

  async function archivia(archiviato: boolean) {
    const result = await setSalvadanaioArchiviato(id, archiviato);
    if (!result.ok) toast.error(result.error);
    else {
      toast.success(archiviato ? "Archiviato: il piano mensile si ferma" : "Riattivato");
      aggiorna();
    }
  }

  const valoriForm: SalvadanaioFormValues = {
    tipo: s.tipo,
    ambito: s.ambito,
    nome: s.nome,
    obiettivo: s.obiettivo === null ? "" : String(s.obiettivo).replace(".", ","),
    data_obiettivo: s.data_obiettivo ?? "",
    strumento: s.strumento ?? "",
    isin: s.isin ?? "",
    piattaforma: s.piattaforma ?? "",
    importo_mensile: s.importo_mensile === null ? "" : String(s.importo_mensile).replace(".", ","),
    giorno_mensile: s.giorno_mensile === null ? "" : String(s.giorno_mensile),
    piano_attivo: s.piano_attivo,
    categoria_id: s.categoria_id ?? "",
    metodo_pagamento_id: s.metodo_pagamento_id ?? "",
    colore: s.colore ?? "",
    note: s.note ?? "",
  };

  return (
    <div className="flex flex-col">
      <PannelloHeader className="gap-2 pr-12 sm:pr-14">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {createElement(icona(tipo.icona), { className: "size-4" })}
          {tipo.singolare}
          {s.ambito === "personale" ? (
            <span className="rounded-full bg-ambito-personale-soft px-2 py-0.5 text-xs text-ambito-personale">Personale</span>
          ) : (
            <span className="rounded-full bg-ambito-lavoro-soft px-2 py-0.5 text-xs text-ambito-lavoro">Lavoro</span>
          )}
          {s.archiviato && <span className="rounded-full bg-muted px-2 py-0.5 text-xs">Archiviato</span>}
        </div>
        <PannelloTitle>{s.nome}</PannelloTitle>
        <PannelloDescription>
          {investimento
            ? [s.strumento, s.isin, s.piattaforma].filter(Boolean).join(" · ") || "Investimento"
            : s.obiettivo
              ? `Obiettivo ${formatCurrency(s.obiettivo)}${s.data_obiettivo ? ` entro il ${formatDate(s.data_obiettivo)}` : ""}`
              : "Senza una cifra obiettivo"}
        </PannelloDescription>
      </PannelloHeader>

      {puoScrivere && (
        <div className="flex flex-wrap gap-2 px-4 sm:px-5">
          {!s.archiviato && (
            <>
              <Button onClick={() => setDialog("versa")}>
                <Plus />
                Versa
              </Button>
              {investimento && (
                <Button variant="outline" onClick={() => setDialog("valore")}>
                  <IconaGrafico />
                  Aggiorna valore
                </Button>
              )}
              <Button variant="outline" onClick={() => setDialog("preleva")} disabled={s.saldo <= 0}>
                <ArrowDownToLine />
                Preleva
              </Button>
            </>
          )}
          <Button variant="outline" onClick={() => setDialog("modifica")}>
            <Pencil />
            Modifica
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" size="icon" aria-label="Altre azioni" />}>
              <MoreHorizontal />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              {s.archiviato ? (
                <DropdownMenuItem onClick={() => archivia(false)}>
                  <ArchiveRestore />
                  Riattiva
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={() => archivia(true)}>
                  <Archive />
                  Archivia
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                variant="destructive"
                disabled={conVersamenti}
                onClick={() =>
                  setConferma({
                    titolo: `Eliminare «${s.nome}»?`,
                    descrizione: "Spariscono anche il piano e le valutazioni. L'operazione non si può annullare.",
                    fatto: "Eliminato",
                    azione: async () => {
                      const result = await deleteSalvadanaio(id);
                      if (result.ok) chiudi();
                      return result;
                    },
                  })
                }
              >
                <Trash2 />
                {conVersamenti ? "Elimina (prima archivia)" : "Elimina"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      <div className="space-y-5 p-4 sm:p-5">
        <div>
          {investimento ? (
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-sm">
              <span>
                <span className="text-2xl font-semibold tracking-tight tabular-nums">
                  {formatCurrency(s.valore_attuale ?? s.saldo)}
                </span>
                <span className="text-muted-foreground"> {s.valore_attuale !== null ? "valore attuale" : "investiti"}</span>
              </span>
              {r && <Rendimento r={r} className="font-medium tabular-nums" />}
            </div>
          ) : (
            <div className="flex items-baseline justify-between text-sm">
              <span>
                <span className="text-2xl font-semibold tracking-tight tabular-nums">{formatCurrency(s.saldo)}</span>
                <span className="text-muted-foreground">{s.obiettivo ? ` di ${formatCurrency(s.obiettivo)}` : " messi da parte"}</span>
              </span>
              {avanzamento !== null && <span className="text-muted-foreground tabular-nums">{avanzamento}%</span>}
            </div>
          )}
          {avanzamento !== null && (
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full" style={{ width: `${avanzamento}%`, backgroundColor: colore }} />
            </div>
          )}
          <p className="mt-1.5 text-xs text-muted-foreground">
            {formatCurrency(s.versato)} versati
            {s.prelevato > 0 && ` · ${formatCurrency(s.prelevato)} prelevati`}
            {investimento && s.valore_attuale !== null && ` · ${formatCurrency(s.saldo)} investiti`}
            {investimento && s.valore_data && ` · valore al ${formatDate(s.valore_data)}`}
          </p>
          {ritmo?.stato === "in_corso" && (
            <p className="mt-1 text-sm">
              Mancano <strong>{formatCurrency(ritmo.mancano)}</strong>: servono circa <strong>{formatCurrency(ritmo.alMese)}</strong> al mese per{" "}
              {ritmo.mesi === 1 ? "1 mese" : `${ritmo.mesi} mesi`}.
            </p>
          )}
          {ritmo?.stato === "raggiunto" && <p className="mt-1 text-sm font-medium text-emerald-700">Obiettivo raggiunto.</p>}
          {ritmo?.stato === "scaduto" && (
            <p className="mt-1 text-sm text-red-600">La data è passata: mancano ancora {formatCurrency(ritmo.mancano)}.</p>
          )}
        </div>

        {s.importo_mensile !== null && (
          <section className="flex flex-wrap items-center gap-3 rounded-lg bg-muted/50 p-3 text-sm">
            <div className="min-w-0 flex-1">
              <p className="font-medium">
                {formatCurrency(s.importo_mensile)} al mese, il giorno {s.giorno_mensile}
                {!s.piano_attivo && <span className="ml-2 text-xs font-normal text-muted-foreground">sospeso</span>}
              </p>
              <p className="text-xs text-muted-foreground">
                {s.previsto_data && s.previsto_importo !== null
                  ? `Prossimo versamento previsto il ${formatDate(s.previsto_data)}${s.previsto_data < oggi ? " (in ritardo)" : ""}`
                  : s.piano_attivo && !s.archiviato
                    ? "Il previsto del mese è già stato versato."
                    : "Nessun versamento previsto."}
              </p>
            </div>
            {puoScrivere && s.previsto_id && (
              <Button size="sm" onClick={() => setDialog("previsto")}>
                Segna versato
              </Button>
            )}
          </section>
        )}

        {serie.length > 1 && (
          <section>
            <h3 className="mb-1 text-sm font-medium">Versato e valore nel tempo</h3>
            <ChartContainer config={CONFIG_GRAFICO} className="h-40 w-full">
              <LineChart data={serie} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                <XAxis dataKey="data" tickLine={false} axisLine={false} tickFormatter={(v: string) => formatDate(v).slice(3)} fontSize={11} interval="preserveStartEnd" />
                <YAxis tickLine={false} axisLine={false} width={44} fontSize={11} tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 100) / 10}k` : String(v))} />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      labelFormatter={(_, p) => formatDate(String(p?.[0]?.payload?.data ?? ""))}
                      formatter={(v, name) => [formatCurrency(Number(v)), CONFIG_GRAFICO[name as keyof typeof CONFIG_GRAFICO]?.label ?? name]}
                    />
                  }
                />
                <ChartLegend content={<ChartLegendContent />} />
                <Line dataKey="versato" type="stepAfter" stroke="var(--color-versato)" strokeWidth={2} strokeDasharray="4 3" dot={false} />
                <Line dataKey="valore" type="monotone" stroke="var(--color-valore)" strokeWidth={2} connectNulls dot={{ r: 3 }} activeDot={{ r: 5 }} />
              </LineChart>
            </ChartContainer>
          </section>
        )}

        <Elenco titolo="Versamenti" vuoto="Nessun versamento: premi «Versa» o segna pagato il previsto del piano.">
          {versamenti.map((m) => (
            <li key={m.id}>
              <button type="button" onClick={() => apri({ tipo: "movimento", id: m.id })} className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-muted/40">
                <span className="w-20 shrink-0 text-muted-foreground tabular-nums">{formatDate(m.data)}</span>
                <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{m.periodo ? "dal piano mensile" : ""}</span>
                <span className="font-medium tabular-nums">{formatCurrency(m.importo)}</span>
              </button>
            </li>
          ))}
        </Elenco>

        {prelievi.length > 0 && (
          <Elenco titolo="Prelievi">
            {prelievi.map((p) => (
              <RigaEliminabile
                key={p.id}
                data={p.data}
                nota={p.note}
                importo={`− ${formatCurrency(p.importo)}`}
                puoEliminare={puoScrivere}
                onElimina={() =>
                  setConferma({
                    titolo: "Eliminare il prelievo?",
                    descrizione: `${formatCurrency(p.importo)} del ${formatDate(p.data)} tornano nel saldo.`,
                    fatto: "Prelievo eliminato",
                    azione: () => deletePrelievo(p.id),
                  })
                }
              />
            ))}
          </Elenco>
        )}

        {investimento && valori.length > 0 && (
          <Elenco titolo="Valutazioni">
            {valori.map((v) => (
              <RigaEliminabile
                key={v.id}
                data={v.data}
                nota={v.note}
                importo={formatCurrency(v.valore)}
                puoEliminare={puoScrivere}
                onElimina={() =>
                  setConferma({
                    titolo: "Eliminare la valutazione?",
                    descrizione: `Il valore del ${formatDate(v.data)} sparisce dallo storico.`,
                    fatto: "Valutazione eliminata",
                    azione: () => deleteValore(v.id),
                  })
                }
              />
            ))}
          </Elenco>
        )}

        {s.note && <p className="text-sm whitespace-pre-wrap">{s.note}</p>}
        <p className="text-xs text-muted-foreground">Creato il {formatDate(s.created_at)}</p>
      </div>

      {dialog === "modifica" && (
        <SalvadanaioDialog
          open
          onOpenChange={(o) => !o && setDialog(null)}
          salvadanaioId={id}
          defaultValues={valoriForm}
          saldo={s.saldo}
          oggi={oggi}
          onSaved={aggiorna}
        />
      )}
      {dialog === "versa" && (
        <PagamentoDialog
          open
          onOpenChange={(o) => !o && setDialog(null)}
          titolo={`Versa in «${s.nome}»`}
          descrizione="Entra nel budget come spesa pagata del mese."
          importo={s.importo_mensile}
          ambito={s.ambito}
          metodoIniziale={s.metodo_pagamento_id ?? ""}
          etichettaImporto="Importo (€)"
          etichettaConferma="Versa"
          messaggio="Versamento registrato"
          onConferma={(v) => versaSalvadanaio(id, v)}
          onFatto={aggiorna}
        />
      )}
      {dialog === "previsto" && s.previsto_id && (
        <PagamentoDialog
          open
          onOpenChange={(o) => !o && setDialog(null)}
          titolo="Segna versato"
          descrizione={`Il versamento del piano previsto il ${formatDate(s.previsto_data ?? oggi)}.`}
          importo={s.previsto_importo}
          ambito={s.ambito}
          metodoIniziale={s.metodo_pagamento_id ?? ""}
          etichettaImporto="Importo versato (€)"
          etichettaConferma="Segna versato"
          messaggio="Versamento registrato"
          onConferma={(v) => segnaPagato(s.previsto_id!, v)}
          onFatto={aggiorna}
        />
      )}
      {dialog === "preleva" && (
        <ImportoDataDialog
          open
          onOpenChange={(o) => !o && setDialog(null)}
          titolo={`Preleva da «${s.nome}»`}
          descrizione="I soldi tornano disponibili: il prelievo non entra nel budget."
          etichettaImporto="Importo (€)"
          etichettaConferma="Preleva"
          messaggio="Prelievo registrato"
          onConferma={(v) => prelevaSalvadanaio(id, v)}
          onFatto={aggiorna}
        />
      )}
      {dialog === "valore" && (
        <ImportoDataDialog
          open
          onOpenChange={(o) => !o && setDialog(null)}
          titolo="Aggiorna il valore"
          descrizione="Quanto vale oggi l'investimento, come lo vedi sulla piattaforma. Un solo valore per giorno."
          etichettaImporto="Valore (€)"
          etichettaConferma="Salva"
          messaggio="Valore aggiornato"
          importo={s.valore_attuale}
          onConferma={(v) => saveValore(id, v)}
          onFatto={aggiorna}
        />
      )}
      <ConfirmDialog
        open={conferma !== null}
        onOpenChange={(o) => !o && setConferma(null)}
        title={conferma?.titolo ?? ""}
        description={conferma?.descrizione}
        onConfirm={async () => {
          if (!conferma) return;
          const result = await conferma.azione();
          if (!result.ok) {
            toast.error(result.error);
            return false;
          }
          toast.success(conferma.fatto);
          aggiorna();
        }}
      />
    </div>
  );
}

function Elenco({ titolo, vuoto, children }: { titolo: string; vuoto?: string; children: React.ReactNode[] }) {
  return (
    <section>
      <h3 className="mb-1.5 text-sm font-medium">
        {titolo}
        {children.length > 0 && <span className="ml-2 text-xs font-normal text-muted-foreground">{children.length}</span>}
      </h3>
      {children.length === 0 ? (
        <p className="text-sm text-muted-foreground">{vuoto}</p>
      ) : (
        <ul className="max-h-72 divide-y overflow-y-auto rounded-lg ring-1 ring-black/8">{children}</ul>
      )}
    </section>
  );
}

function RigaEliminabile({
  data,
  nota,
  importo,
  puoEliminare,
  onElimina,
}: {
  data: string;
  nota: string | null;
  importo: string;
  puoEliminare: boolean;
  onElimina: () => void;
}) {
  return (
    <li className="group flex items-center gap-3 px-3 py-2 text-sm">
      <span className="w-20 shrink-0 text-muted-foreground tabular-nums">{formatDate(data)}</span>
      <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{nota}</span>
      <span className="font-medium tabular-nums">{importo}</span>
      {puoEliminare && (
        <button
          type="button"
          aria-label="Elimina"
          onClick={onElimina}
          className={cn(
            "grid size-6 place-items-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive",
            "[@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 focus-visible:opacity-100",
          )}
        >
          <X className="size-3.5" />
        </button>
      )}
    </li>
  );
}
