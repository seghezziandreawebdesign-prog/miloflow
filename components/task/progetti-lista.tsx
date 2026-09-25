"use client";

import { FolderKanban, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { EmptyState } from "@/components/empty-state";
import { Segmented } from "@/components/segmented";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ambitoDiDefault, type FiltroAmbito } from "@/lib/ambito";
import { formatGiornoRelativo, todayISO } from "@/lib/dates/format";
import { progettoVuoto } from "@/lib/schemas/task";
import { alberoProgetti, avanzamento, statoProgetto } from "@/lib/task";
import { cn } from "@/lib/utils";

import { useProgetti, type ProgettoLista } from "./dati";
import { ProgettoDialog } from "./progetto-dialog";
import { Progresso } from "./progresso";

const FILTRI = [
  { value: "correnti", label: "In corso" },
  { value: "completato", label: "Completati" },
  { value: "archiviato", label: "Archiviati" },
  { value: "tutti", label: "Tutti" },
] as const;
type Filtro = (typeof FILTRI)[number]["value"];

export function ProgettiLista({ filtroAmbito }: { filtroAmbito: FiltroAmbito }) {
  const { data: progetti, isPending } = useProgetti(filtroAmbito);
  const [filtro, setFiltro] = useState<Filtro>("correnti");
  const [nuovoOpen, setNuovoOpen] = useState(false);
  const router = useRouter();

  const visibili = (progetti ?? []).filter((p) => {
    if (filtro === "tutti") return true;
    if (filtro === "correnti") return p.stato === "attivo" || p.stato === "in_pausa";
    return p.stato === filtro;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented label="" value={filtro} onChange={setFiltro} opzioni={FILTRI} />
        <Button onClick={() => setNuovoOpen(true)}>
          <Plus />
          Nuovo progetto
        </Button>
      </div>

      {isPending ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : visibili.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title={filtro === "correnti" ? "Nessun progetto in corso" : "Nessun progetto"}
          description="Un progetto raggruppa le task di un lavoro o di un obiettivo, con avanzamento e kanban."
          action={
            <Button onClick={() => setNuovoOpen(true)}>
              <Plus />
              Crea il primo progetto
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {alberoProgetti(visibili).map((ramo) => (
            <div key={ramo.padre.id} className="space-y-2 self-start">
              <ProgettoCard progetto={ramo.padre} />
              {ramo.figli.map((f) => (
                <SottoprogettoRiga key={f.id} progetto={f} />
              ))}
            </div>
          ))}
        </div>
      )}

      <ProgettoDialog
        open={nuovoOpen}
        onOpenChange={setNuovoOpen}
        defaultValues={progettoVuoto(ambitoDiDefault(filtroAmbito))}
        onSaved={(id) => router.push(`/task/progetti/${id}`)}
      />
    </div>
  );
}

/** Riga compatta di un sottoprogetto, sotto la card del padre. */
function SottoprogettoRiga({ progetto: p }: { progetto: ProgettoLista }) {
  const stato = statoProgetto(p.stato ?? "attivo");
  return (
    <Link
      href={`/task/progetti/${p.id}`}
      className="ml-4 flex items-center gap-2 rounded-lg bg-card px-3 py-2 text-sm ring-1 ring-black/8 transition-shadow hover:shadow-md"
    >
      <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: p.colore ?? "var(--muted-foreground)" }} />
      <span className={cn("truncate", p.stato === "in_pausa" && "text-muted-foreground")}>{p.nome}</span>
      {p.stato !== "attivo" && p.stato !== "in_pausa" && (
        <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-xs ring-1 ring-inset", stato.className)}>{stato.label}</span>
      )}
      <span
        className="ml-auto h-1 w-10 shrink-0 overflow-hidden rounded-full bg-black/8"
        title={`${p.task_fatte ?? 0} task fatte su ${p.task_totali ?? 0}`}
      >
        <span
          className="block h-full rounded-full"
          style={{ width: `${avanzamento(p.task_fatte ?? 0, p.task_totali ?? 0)}%`, backgroundColor: p.colore ?? "var(--primary)" }}
        />
      </span>
    </Link>
  );
}

export function ProgettoCard({ progetto: p, senzaCliente }: { progetto: ProgettoLista; senzaCliente?: boolean }) {
  const stato = statoProgetto(p.stato ?? "attivo");
  const oggi = todayISO();
  const scaduto = p.scadenza && p.scadenza < oggi && p.stato !== "completato" && p.stato !== "archiviato";
  return (
    <Link
      href={`/task/progetti/${p.id}`}
      className="flex flex-col gap-3 rounded-xl bg-card p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-black/8 transition-shadow hover:shadow-md"
    >
      <div className="flex items-start gap-2">
        <span className="mt-1.5 size-2.5 shrink-0 rounded-full" style={{ backgroundColor: p.colore ?? "var(--muted-foreground)" }} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{p.nome}</p>
          {!senzaCliente && p.cliente_nome && <p className="truncate text-xs text-muted-foreground">{p.cliente_nome}</p>}
        </div>
        {p.stato !== "attivo" && (
          <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-xs ring-1 ring-inset", stato.className)}>
            {stato.label}
          </span>
        )}
      </div>
      <Progresso fatte={p.task_fatte ?? 0} totali={p.task_totali ?? 0} colore={p.colore} />
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {p.ambito === "personale" && (
          <span className="rounded-full bg-ambito-personale-soft px-2 py-0.5 text-ambito-personale">Personale</span>
        )}
        {p.scadenza && (
          <span className={cn(scaduto && "font-medium text-red-600")}>
            Scadenza {formatGiornoRelativo(p.scadenza, oggi).toLowerCase()}
          </span>
        )}
      </div>
    </Link>
  );
}
