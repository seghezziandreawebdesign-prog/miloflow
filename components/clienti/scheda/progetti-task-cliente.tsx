"use client";

import { FolderKanban, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { EmptyState } from "@/components/empty-state";
import { AggiuntaRapida } from "@/components/task/aggiunta-rapida";
import { useProgettiCliente, useTaskCliente } from "@/components/task/dati";
import { GruppoTask, ListaSkeleton, ListaTask } from "@/components/task/liste";
import { ProgettoCard } from "@/components/task/progetti-lista";
import { ProgettoDialog } from "@/components/task/progetto-dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { progettoVuoto } from "@/lib/schemas/task";
import { confrontaTask } from "@/lib/task";

/** Tab "Progetti e task" della scheda cliente. */
export function ProgettiTaskCliente({ clienteId }: { clienteId: string }) {
  const { data: progetti, isPending: progettiPending } = useProgettiCliente(clienteId);
  const { data: tasks, isPending: taskPending } = useTaskCliente(clienteId);
  const [nuovoOpen, setNuovoOpen] = useState(false);
  const [tuttiProgetti, setTuttiProgetti] = useState(false);
  const router = useRouter();

  const correnti = (progetti ?? []).filter((p) => p.stato === "attivo" || p.stato === "in_pausa");
  const altri = (progetti ?? []).length - correnti.length;
  const visibili = tuttiProgetti ? (progetti ?? []) : correnti;
  const senzaProgetto = (tasks ?? []).filter((t) => !t.progetto_id && t.stato !== "fatto").sort(confrontaTask);

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">Progetti</h2>
          <div className="flex items-center gap-2">
            {altri > 0 && (
              <Button variant="ghost" size="sm" onClick={() => setTuttiProgetti((v) => !v)}>
                {tuttiProgetti ? "Solo in corso" : `Mostra anche completati e archiviati (${altri})`}
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => setNuovoOpen(true)}>
              <Plus />
              Nuovo progetto
            </Button>
          </div>
        </div>
        {progettiPending ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <Skeleton className="h-28 rounded-xl" />
            <Skeleton className="h-28 rounded-xl" />
          </div>
        ) : visibili.length === 0 ? (
          <EmptyState
            icon={FolderKanban}
            title="Nessun progetto in corso"
            description="Crea un progetto per raggruppare le task di un lavoro per questo cliente."
            action={
              <Button onClick={() => setNuovoOpen(true)}>
                <Plus />
                Nuovo progetto
              </Button>
            }
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {visibili.map((p) => (
              <ProgettoCard key={p.id} progetto={p} senzaCliente />
            ))}
          </div>
        )}
      </section>

      <GruppoTask titolo="Task senza progetto" conteggio={senzaProgetto.length}>
        <div className="space-y-2 pt-2">
          <AggiuntaRapida
            defaults={{ ambito: "lavoro", cliente_id: clienteId }}
            placeholder="Aggiungi una task per questo cliente"
          />
          {taskPending ? (
            <ListaSkeleton righe={2} />
          ) : (
            <ListaTask tasks={senzaProgetto} opzioni={{ senzaCliente: true }} vuoto="Nessuna task aperta fuori dai progetti." />
          )}
        </div>
      </GruppoTask>

      <ProgettoDialog
        open={nuovoOpen}
        onOpenChange={setNuovoOpen}
        defaultValues={progettoVuoto("lavoro", clienteId)}
        onSaved={(id) => router.push(`/task/progetti/${id}`)}
      />
    </div>
  );
}
