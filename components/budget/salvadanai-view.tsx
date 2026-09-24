"use client";

import { Plus } from "lucide-react";
import { useState } from "react";

import { useApriEntita } from "@/components/drawer/use-apri-entita";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import type { FiltroAmbito } from "@/lib/ambito";
import { formatCurrency, formatDate } from "@/lib/dates/format";
import { icona } from "@/lib/icone";
import {
  avanzamentoObiettivo,
  rendimento,
  ritmoObiettivo,
  TIPI_SALVADANAIO,
  totaliSalvadanai,
  type Salvadanaio,
  type TipoSalvadanaio,
} from "@/lib/salvadanai";
import { salvadanaioVuoto } from "@/lib/schemas/salvadanai";
import { cn } from "@/lib/utils";

import { CategoriaIcona } from "./categoria-icona";
import { SalvadanaioDialog } from "./salvadanaio-dialog";

const COLORE_DEFAULT: Record<TipoSalvadanaio, string> = { risparmio: "#0d9488", investimento: "#0f766e" };

/** Tab Risparmi e tab Investimenti: una card per obiettivo o fondo. */
export function SalvadanaiView({
  tipo,
  salvadanai,
  oggi,
  filtroAmbito,
  scrittura,
  categoriaDefault,
}: {
  tipo: TipoSalvadanaio;
  salvadanai: Salvadanaio[];
  oggi: string;
  filtroAmbito: FiltroAmbito;
  scrittura: boolean;
  /** Categoria proposta per i versamenti ("Risparmi" o "Investimenti"). */
  categoriaDefault: string;
}) {
  const [nuovo, setNuovo] = useState(false);
  const apri = useApriEntita();
  const t = TIPI_SALVADANAIO[tipo];
  const attivi = salvadanai.filter((s) => !s.archiviato);
  const archiviati = salvadanai.filter((s) => s.archiviato);
  const totali = totaliSalvadanai(salvadanai);
  const investimento = tipo === "investimento";
  const alMese = attivi.reduce((acc, s) => acc + (s.piano_attivo && s.importo_mensile ? s.importo_mensile : 0), 0);

  const pulsanteNuovo = scrittura ? (
    <Button onClick={() => setNuovo(true)}>
      <Plus />
      {t.nuovo}
    </Button>
  ) : undefined;

  return (
    <div className="space-y-4">
      {salvadanai.length === 0 ? (
        <EmptyState
          icon={icona(t.icona)}
          title={investimento ? "Nessun investimento" : "Nessun obiettivo di risparmio"}
          description={
            investimento
              ? "Segna su quale fondo investi e quanto: un piano mensile (es. 400 €) crea ogni mese il versamento previsto nel budget."
              : "Un obiettivo con una cifra (es. Viaggio a New York, 3.000 €): ogni mese ci metti quello che vuoi e vedi quanto manca."
          }
          action={pulsanteNuovo}
        />
      ) : (
        <>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <dl className="flex flex-wrap gap-x-8 gap-y-2">
              <Totale label={investimento ? "Investito" : "Messo da parte"} valore={formatCurrency(totali.saldo)} />
              {investimento && totali.valore !== null && <Totale label="Valore attuale" valore={formatCurrency(totali.valore)} />}
              {investimento && totali.rendimento && <Totale label="Rendimento" valore={<Rendimento r={totali.rendimento} />} />}
              {alMese > 0 && <Totale label="Piani mensili" valore={`${formatCurrency(alMese)}/mese`} />}
            </dl>
            {pulsanteNuovo}
          </div>

          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {attivi.map((s) => (
              <li key={s.id}>
                <Card s={s} oggi={oggi} onOpen={() => apri({ tipo: "salvadanaio", id: s.id })} />
              </li>
            ))}
          </ul>

          {archiviati.length > 0 && (
            <section>
              <h3 className="mb-1.5 px-1 text-xs font-medium text-muted-foreground">Archiviati</h3>
              <ul className="divide-y rounded-xl bg-card ring-1 ring-black/8">
                {archiviati.map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => apri({ tipo: "salvadanaio", id: s.id })}
                      className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm hover:bg-muted/40"
                    >
                      <span className="min-w-0 flex-1 truncate">{s.nome}</span>
                      <span className="text-muted-foreground tabular-nums">{formatCurrency(s.saldo)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      {nuovo && (
        <SalvadanaioDialog
          open
          onOpenChange={(o) => !o && setNuovo(false)}
          // Risparmi e investimenti sono di solito personali: lavoro solo se lo switch è su Lavoro.
          defaultValues={salvadanaioVuoto(tipo, filtroAmbito === "lavoro" ? "lavoro" : "personale", categoriaDefault)}
          oggi={oggi}
          onSaved={(id) => apri({ tipo: "salvadanaio", id })}
        />
      )}
    </div>
  );
}

function Totale({ label, valore }: { label: string; valore: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-xl font-semibold tracking-tight tabular-nums">{valore}</dd>
    </div>
  );
}

export function Rendimento({ r, className }: { r: { euro: number; percento: number | null }; className?: string }) {
  const segno = r.euro > 0 ? "+" : "";
  return (
    <span className={cn(r.euro > 0 ? "text-emerald-700" : r.euro < 0 ? "text-red-600" : undefined, className)}>
      {segno}
      {formatCurrency(r.euro)}
      {r.percento !== null && ` (${segno}${r.percento.toLocaleString("it-IT")}%)`}
    </span>
  );
}

function Card({ s, oggi, onOpen }: { s: Salvadanaio; oggi: string; onOpen: () => void }) {
  const investimento = s.tipo === "investimento";
  const colore = s.colore ?? COLORE_DEFAULT[s.tipo];
  const avanzamento = investimento ? null : avanzamentoObiettivo(s.saldo, s.obiettivo);
  const ritmo = investimento ? null : ritmoObiettivo(s, oggi);
  const r = investimento ? rendimento(s.saldo, s.valore_attuale) : null;
  const sottotitolo = investimento
    ? [s.strumento, s.piattaforma].filter(Boolean).join(" · ")
    : s.data_obiettivo
      ? `Entro il ${formatDate(s.data_obiettivo)}`
      : null;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex h-full w-full flex-col rounded-xl bg-card p-4 text-left ring-1 ring-black/8 transition-colors hover:bg-muted/40"
    >
      <div className="flex w-full items-start gap-3">
        <CategoriaIcona nome={s.icona ?? TIPI_SALVADANAIO[s.tipo].icona} colore={colore} size="md" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{s.nome}</p>
          <p className="truncate text-xs text-muted-foreground">
            {sottotitolo || TIPI_SALVADANAIO[s.tipo].singolare}
            {s.ambito === "lavoro" && <span className="ml-1.5 inline-block size-1.5 rounded-full bg-ambito-lavoro align-middle" />}
          </p>
        </div>
        <div className="text-right">
          <p className="font-semibold tabular-nums">{formatCurrency(investimento && s.valore_attuale !== null ? s.valore_attuale : s.saldo)}</p>
          <p className="text-xs text-muted-foreground">
            {investimento ? (s.valore_attuale !== null ? "valore" : "investito") : s.obiettivo ? `di ${formatCurrency(s.obiettivo)}` : "da parte"}
          </p>
        </div>
      </div>

      {avanzamento !== null && (
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full" style={{ width: `${avanzamento}%`, backgroundColor: colore }} />
        </div>
      )}

      <div className="mt-2 flex w-full flex-wrap justify-between gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
        <span>
          {investimento ? (
            <>
              {formatCurrency(s.saldo)} investiti
              {r && (
                <>
                  {" · "}
                  <Rendimento r={r} className="font-medium" />
                </>
              )}
            </>
          ) : avanzamento !== null ? (
            ritmo?.stato === "raggiunto" ? (
              <span className="font-medium text-emerald-700">Obiettivo raggiunto</span>
            ) : (
              `${avanzamento}% · mancano ${formatCurrency(Math.max(0, (s.obiettivo ?? 0) - s.saldo))}`
            )
          ) : (
            `${s.versamenti} ${s.versamenti === 1 ? "versamento" : "versamenti"}`
          )}
        </span>
        {s.importo_mensile && s.piano_attivo ? (
          <span>
            {formatCurrency(s.importo_mensile)}/mese
            {s.previsto_data && ` · prossimo ${formatDate(s.previsto_data).slice(0, 5)}`}
          </span>
        ) : ritmo?.stato === "in_corso" ? (
          <span>servono {formatCurrency(ritmo.alMese)}/mese</span>
        ) : ritmo?.stato === "scaduto" ? (
          <span className="text-red-600">data superata</span>
        ) : null}
      </div>
    </button>
  );
}
