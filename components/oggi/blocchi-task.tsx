"use client";

import { Hourglass } from "lucide-react";

import { useTaskAperte } from "@/components/task/dati";
import { ListaSkeleton, ListaTask } from "@/components/task/liste";
import { VistaOggi } from "@/components/task/task-view";
import type { FiltroAmbito } from "@/lib/ambito";
import { todayISO } from "@/lib/dates/format";
import { daSollecitare, GIORNI_SOLLECITO } from "@/lib/task";

import { Blocco } from "./blocco";

/** Task di oggi e in ritardo, con spunta diretta e aggiunta rapida. */
export function BloccoTaskOggi({ filtroAmbito }: { filtroAmbito: FiltroAmbito }) {
  const { data, isPending } = useTaskAperte(filtroAmbito);
  return (
    <Blocco titolo="Task" link={{ href: "/task?vista=settimana", label: "Prossimi 7 giorni" }}>
      {isPending ? <ListaSkeleton /> : <VistaOggi tasks={data ?? []} filtroAmbito={filtroAmbito} />}
    </Blocco>
  );
}

/** Task in attesa da più di 5 giorni: da sollecitare. Si nasconde se vuoto. */
export function BloccoDaSollecitare({ filtroAmbito }: { filtroAmbito: FiltroAmbito }) {
  const { data } = useTaskAperte(filtroAmbito);
  const oggi = todayISO();
  const tasks = (data ?? [])
    .filter((t) => daSollecitare(t, oggi))
    .sort((a, b) => (a.in_attesa_dal ?? "").localeCompare(b.in_attesa_dal ?? ""));
  if (tasks.length === 0) return null;
  return (
    <Blocco
      titolo="Da sollecitare"
      icona={Hourglass}
      descrizione={`In attesa da più di ${GIORNI_SOLLECITO} giorni.`}
      link={{ href: "/task?vista=attesa", label: "Tutte in attesa" }}
    >
      <ListaTask tasks={tasks} />
    </Blocco>
  );
}
