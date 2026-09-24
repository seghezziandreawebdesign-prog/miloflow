"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Landmark, Paperclip, PiggyBank, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { useApriEntita } from "@/components/drawer/use-apri-entita";
import { Button } from "@/components/ui/button";
import { segnaPagato } from "@/lib/actions/budget";
import { etichettaCategoriaMovimento, type Movimento } from "@/lib/budget";
import { capitalize, formatCurrency, formatGiornoRelativo } from "@/lib/dates/format";
import { cn } from "@/lib/utils";

import { CategoriaIcona } from "./categoria-icona";
import { invalidaBudget } from "./dati";
import { PagamentoDialog } from "./pagamento-dialog";

/** Movimenti raggruppati per giorno; i previsti in grigio con "Segna pagato". */
export function ListaMovimenti({ movimenti, oggi, scrittura }: { movimenti: Movimento[]; oggi: string; scrittura: boolean }) {
  const giorni = new Map<string, Movimento[]>();
  for (const m of movimenti) {
    const lista = giorni.get(m.data) ?? [];
    lista.push(m);
    giorni.set(m.data, lista);
  }
  return (
    <div className="space-y-4">
      {[...giorni.entries()].map(([giorno, lista]) => (
        <section key={giorno}>
          <h3 className="mb-1.5 flex items-baseline justify-between px-1 text-xs font-medium text-muted-foreground">
            <span>{capitalize(formatGiornoRelativo(giorno, oggi))}</span>
            <span className="tabular-nums">{formatCurrency(lista.reduce((acc, m) => acc + m.importo, 0))}</span>
          </h3>
          <ul className="divide-y rounded-xl bg-card ring-1 ring-black/8">
            {lista.map((m) => (
              <RigaMovimento key={m.id} movimento={m} scrittura={scrittura} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

export function RigaMovimento({ movimento: m, scrittura, compatta }: { movimento: Movimento; scrittura: boolean; compatta?: boolean }) {
  const apri = useApriEntita();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [paga, setPaga] = useState(false);
  const previsto = m.stato === "previsto";
  const categoria = etichettaCategoriaMovimento(m);
  const origine = m.servizio_id
    ? "Servizio"
    : m.rata_id
      ? `Rata ${m.rata_numero ?? ""}`.trim()
      : m.salvadanaio_nome
        ? `In «${m.salvadanaio_nome}»`
        : null;

  return (
    <li className={cn("flex items-center gap-3 px-3 py-2.5", previsto && "text-muted-foreground")}>
      <button type="button" onClick={() => apri({ tipo: "movimento", id: m.id })} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <CategoriaIcona nome={m.categoria_icona} colore={m.categoria_colore} className={previsto ? "opacity-50" : undefined} />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className={cn("truncate text-sm", !previsto && "font-medium text-foreground")}>{m.descrizione || categoria || "Movimento"}</span>
            {m.servizio_id && <RefreshCw className="size-3 shrink-0" aria-label="Da un servizio" />}
            {m.rata_id && <Landmark className="size-3 shrink-0" aria-label="Rata di un debito" />}
            {m.salvadanaio_id && <PiggyBank className="size-3 shrink-0" aria-label="Versamento in un risparmio o investimento" />}
            {m.ricevuta_path && <Paperclip className="size-3 shrink-0" aria-label="Con ricevuta" />}
          </span>
          {!compatta && (
            <span className="block truncate text-xs text-muted-foreground">
              {[categoria, origine, m.metodo_nome ? (m.metodo_cifre ? `${m.metodo_nome} •${m.metodo_cifre}` : m.metodo_nome) : null, previsto ? "previsto" : null]
                .filter(Boolean)
                .join(" · ")}
              <span className={`ml-1.5 inline-block size-1.5 rounded-full align-middle ${m.ambito === "personale" ? "bg-ambito-personale" : "bg-ambito-lavoro"}`} />
            </span>
          )}
        </span>
        <span className={cn("shrink-0 text-sm tabular-nums", !previsto && "font-medium text-foreground")}>{formatCurrency(m.importo)}</span>
      </button>
      {previsto && scrittura && (
        <Button variant="outline" size="sm" className="shrink-0" onClick={() => setPaga(true)}>
          Segna pagato
        </Button>
      )}
      {paga && (
        <PagamentoDialog
          open
          onOpenChange={(o) => !o && setPaga(false)}
          titolo="Segna pagato"
          descrizione={m.descrizione ?? undefined}
          importo={m.importo}
          ambito={m.ambito}
          metodoIniziale={m.metodo_pagamento_id ?? ""}
          onConferma={(v) => segnaPagato(m.id, v)}
          onFatto={() => {
            invalidaBudget(queryClient);
            router.refresh();
          }}
        />
      )}
    </li>
  );
}
