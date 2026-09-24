"use client";

import { useMemo, useState } from "react";

import { BarraFiltri } from "@/components/filtri/barra-filtri";
import { FiltroChip } from "@/components/filtri/filtro-chip";
import type { FiltroAmbito } from "@/lib/ambito";
import { todayISO } from "@/lib/dates/format";
import { addDays } from "@/lib/dates/giorni";

import { useOpzioniTask, useTaskArchivio } from "./dati";
import { Kanban } from "./kanban";
import { ListaSkeleton } from "./liste";

const TUTTI = "tutti";
/** Nella colonna Fatto restano le task completate negli ultimi giorni. */
const GIORNI_FATTE = 14;

/** Board di tutte le task per stato, con filtro per progetto e cliente. */
export function Board({ filtroAmbito }: { filtroAmbito: FiltroAmbito }) {
  const { data, isPending } = useTaskArchivio(filtroAmbito);
  const { data: opzioni } = useOpzioniTask();
  const [progetto, setProgetto] = useState(TUTTI);
  const [cliente, setCliente] = useState(TUTTI);
  const limite = addDays(todayISO(), -GIORNI_FATTE);

  const tasks = useMemo(
    () =>
      (data ?? []).filter((t) => {
        if (t.parent_id) return false;
        if (t.stato === "fatto" && (t.completata_il ?? "").slice(0, 10) < limite) return false;
        if (progetto !== TUTTI && (t.progetto_id ?? "nessuno") !== progetto) return false;
        if (cliente !== TUTTI && (t.cliente_id ?? "nessuno") !== cliente) return false;
        return true;
      }),
    [data, progetto, cliente, limite],
  );

  const filtri = [
    {
      label: "Progetto",
      value: progetto,
      set: setProgetto,
      items: [
        { value: TUTTI, label: "Tutti" },
        { value: "nessuno", label: "Senza progetto" },
        ...(opzioni?.progetti ?? []).map((p) => ({ value: p.id, label: p.nome })),
      ],
    },
    {
      label: "Cliente",
      value: cliente,
      set: setCliente,
      items: [
        { value: TUTTI, label: "Tutti" },
        { value: "nessuno", label: "Senza cliente" },
        ...(opzioni?.clienti ?? []).map((c) => ({ value: c.id, label: c.nome })),
      ],
    },
  ];

  return (
    <div className="space-y-4">
      <BarraFiltri
        azzera={
          progetto !== TUTTI || cliente !== TUTTI
            ? () => {
                setProgetto(TUTTI);
                setCliente(TUTTI);
              }
            : null
        }
      >
        {filtri.map((f) => (
          <FiltroChip key={f.label} label={f.label} value={f.value} onChange={f.set} opzioni={f.items} />
        ))}
      </BarraFiltri>
      <p className="text-xs text-muted-foreground">
        Trascina una task per cambiarne lo stato. In «Fatto» restano le completate degli ultimi {GIORNI_FATTE} giorni.
      </p>
      {isPending ? <ListaSkeleton /> : <Kanban tasks={tasks} opzioniRiga={{}} />}
    </div>
  );
}
