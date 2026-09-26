"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, RefreshCw, Wallet } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { aggiornaPrevisti } from "@/lib/actions/budget";
import type { Categoria, Movimento, TotaliMese } from "@/lib/budget";
import { formatCurrency } from "@/lib/dates/format";
import { cn } from "@/lib/utils";

import { BarraCategoria } from "./barra-categoria";
import { invalidaBudget } from "./dati";
import { ListaMovimenti } from "./lista-movimenti";
import { useNuovaSpesa } from "./nuova-spesa";

export function MeseView({
  mese,
  oggi,
  movimenti,
  categorie,
  totali,
  scrittura,
  owner,
}: {
  mese: string;
  oggi: string;
  movimenti: Movimento[];
  categorie: Categoria[];
  totali: TotaliMese;
  scrittura: boolean;
  owner: boolean;
}) {
  const nuovaSpesa = useNuovaSpesa();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [pending, startTransition] = useTransition();

  function aggiorna() {
    startTransition(async () => {
      const result = await aggiornaPrevisti(mese);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(result.data.righe === 0 ? "Previsti già aggiornati" : "Previsti aggiornati");
      invalidaBudget(queryClient);
      router.refresh();
    });
  }

  const sfora = totali.budget > 0 && totali.rimanente < 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {scrittura && (
          <Button onClick={() => nuovaSpesa({ data: mese <= oggi && oggi < `${mese.slice(0, 7)}-32` ? oggi : mese })}>
            <Plus />
            Nuova spesa
          </Button>
        )}
        {owner && (
          <Button variant="outline" onClick={aggiorna} disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : <RefreshCw />}
            Aggiorna previsti
          </Button>
        )}
      </div>

      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-5">
        <Contatore label="Guadagnato" valore={totali.guadagnato} tono={totali.guadagnato > 0 ? "text-scadenza-ok" : "text-muted-foreground"} />
        <Contatore label="Budget" valore={totali.budget} />
        <Contatore label="Speso" valore={totali.speso} />
        <Contatore label="Previsto da pagare" valore={totali.previsto} tono="text-muted-foreground" />
        <Contatore
          label="Rimanente"
          valore={totali.rimanente}
          tono={totali.budget === 0 ? "text-muted-foreground" : sfora ? "text-destructive" : "text-scadenza-ok"}
        />
      </dl>

      {totali.barre.length > 0 && (
        <section className="rounded-xl bg-card p-4 ring-1 ring-black/8">
          <h3 className="mb-3 text-sm font-medium">Per categoria</h3>
          <ul className="space-y-3">
            {totali.barre.map((b) => (
              <BarraCategoria key={b.categoria?.id ?? "senza"} barra={b} mese={mese} categorie={categorie} scrittura={scrittura} />
            ))}
          </ul>
        </section>
      )}

      {movimenti.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="Nessun movimento questo mese"
          description={scrittura ? "Aggiungi la prima spesa, oppure aggiorna i previsti da servizi e rate." : undefined}
          action={
            scrittura ? (
              <Button onClick={() => nuovaSpesa()}>
                <Plus />
                Nuova spesa
              </Button>
            ) : undefined
          }
        />
      ) : (
        <ListaMovimenti movimenti={movimenti} oggi={oggi} scrittura={scrittura} />
      )}
    </div>
  );
}

function Contatore({ label, valore, tono }: { label: string; valore: number; tono?: string }) {
  return (
    <div className="rounded-xl bg-card px-4 py-3 ring-1 ring-black/8">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={cn("mt-0.5 text-lg font-semibold tabular-nums tracking-tight", tono)}>{formatCurrency(valore)}</dd>
    </div>
  );
}
