"use client";

import {
  createColumnHelper,
  createSortedRowModel,
  rowSortingFeature,
  tableFeatures,
  useTable,
} from "@tanstack/react-table";
import { ArrowUpDown } from "lucide-react";
import { useMemo, useState } from "react";

import { useApriEntita } from "@/components/drawer/use-apri-entita";
import { BarraFiltri, CampoRicerca } from "@/components/filtri/barra-filtri";
import { FiltroChip } from "@/components/filtri/filtro-chip";
import { attributiSelezione, CasellaSelezione, useSelezione } from "@/components/selezione";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { FiltroAmbito } from "@/lib/ambito";
import { formatDate, todayISO } from "@/lib/dates/format";
import { normalizza } from "@/lib/parsing/task-rapida";
import { PRIORITA, priorita, statoTask, STATI_TASK } from "@/lib/task";
import { testoSemplice } from "@/lib/testo-ricco";
import { cn } from "@/lib/utils";

import { useOpzioniTask, useTaskArchivio, type TaskLista } from "./dati";
import { EliminaTaskButton } from "./elimina-task";
import { ListaSkeleton, ListaTask } from "./liste";
import { TaskCheckbox } from "./task-checkbox";

const features = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
});
const col = createColumnHelper<typeof features, TaskLista>();

// Le date vuote vanno in fondo in entrambi i versi.
const perData = (a: string | null, b: string | null) => (a ?? "9999-12-31").localeCompare(b ?? "9999-12-31");

type Filtri = {
  testo: string;
  stato: string;
  priorita: string;
  ambito: string;
  cliente: string;
  progetto: string;
  assegnata: string;
};

const TUTTI = "tutti";

const FILTRI_INIZIALI: Filtri = {
  testo: "",
  stato: "aperte",
  priorita: TUTTI,
  ambito: TUTTI,
  cliente: TUTTI,
  progetto: TUTTI,
  assegnata: TUTTI,
};

export function TutteTabella({ filtroAmbito }: { filtroAmbito: FiltroAmbito }) {
  const { data, isPending } = useTaskArchivio(filtroAmbito);
  const { data: opzioni } = useOpzioniTask();
  const apri = useApriEntita();
  const selezione = useSelezione();
  const [filtri, setFiltri] = useState<Filtri>(FILTRI_INIZIALI);
  const set = (patch: Partial<Filtri>) => setFiltri((f) => ({ ...f, ...patch }));
  const filtriAttivi = (Object.keys(FILTRI_INIZIALI) as (keyof Filtri)[]).some((k) => filtri[k] !== FILTRI_INIZIALI[k]);
  const oggi = todayISO();
  const multiUtente = (opzioni?.utenti.length ?? 0) > 1;

  const filtrate = useMemo(() => {
    const q = normalizza(filtri.testo.trim());
    return (data ?? []).filter((t) => {
      if (t.parent_id) return false;
      if (filtri.stato === "aperte" && t.stato === "fatto") return false;
      if (filtri.stato !== "aperte" && filtri.stato !== TUTTI && t.stato !== filtri.stato) return false;
      if (filtri.priorita !== TUTTI && String(t.priorita ?? "nessuna") !== filtri.priorita) return false;
      if (filtri.ambito !== TUTTI && t.ambito !== filtri.ambito) return false;
      if (filtri.cliente !== TUTTI && (t.cliente_id ?? "nessuno") !== filtri.cliente) return false;
      if (filtri.progetto !== TUTTI && (t.progetto_id ?? "nessuno") !== filtri.progetto) return false;
      if (filtri.assegnata !== TUTTI && (t.assegnata_a ?? "nessuno") !== filtri.assegnata) return false;
      if (q && !normalizza(`${t.titolo} ${testoSemplice(t.note)}`).includes(q)) return false;
      return true;
    });
  }, [data, filtri]);

  const nomeUtente = useMemo(() => new Map((opzioni?.utenti ?? []).map((u) => [u.id, u.nome])), [opzioni]);

  const columns = useMemo(
    () =>
      col.columns([
        col.accessor("titolo", {
          header: "Task",
          cell: ({ row }) => (
            <div className="flex items-start gap-2.5">
              <SpuntaOSelezione task={row.original} />
              <span className={cn("min-w-0 break-words", row.original.stato === "fatto" && "text-muted-foreground line-through")}>
                {row.original.titolo}
              </span>
            </div>
          ),
          sortFn: (a, b) => a.original.titolo.localeCompare(b.original.titolo, "it"),
        }),
        col.accessor("stato", {
          header: "Stato",
          cell: ({ getValue }) => {
            const s = statoTask(getValue());
            return <span className={cn("rounded-full px-2 py-0.5 text-xs whitespace-nowrap ring-1 ring-inset", s.className)}>{s.label}</span>;
          },
        }),
        col.accessor("priorita", {
          header: "Priorità",
          cell: ({ getValue }) => {
            const p = priorita(getValue());
            return p ? <span className={cn("text-xs font-medium", p.className)}>{p.label}</span> : null;
          },
          sortFn: (a, b) => (a.original.priorita ?? 4) - (b.original.priorita ?? 4),
        }),
        col.accessor("data_pianificata", {
          header: "Inizio",
          cell: ({ row, getValue }) => {
            const v = getValue();
            const ritardo = v && row.original.stato !== "fatto" && v < oggi;
            return v ? <span className={cn("whitespace-nowrap", ritardo && "text-red-600")}>{formatDate(v)}</span> : null;
          },
          sortFn: (a, b) => perData(a.original.data_pianificata, b.original.data_pianificata),
        }),
        col.accessor("scadenza", {
          header: "Scadenza",
          cell: ({ row, getValue }) => {
            const v = getValue();
            const scaduta = v && row.original.stato !== "fatto" && v < oggi;
            return v ? <span className={cn("whitespace-nowrap", scaduta && "font-medium text-red-600")}>{formatDate(v)}</span> : null;
          },
          sortFn: (a, b) => perData(a.original.scadenza, b.original.scadenza),
        }),
        col.accessor((t) => t.progetti?.nome ?? "", {
          id: "progetto",
          header: "Progetto",
          cell: ({ getValue }) => <span className="line-clamp-1">{getValue()}</span>,
          sortFn: (a, b, id) => String(a.getValue(id)).localeCompare(String(b.getValue(id)), "it"),
        }),
        col.accessor((t) => t.cliente_nome ?? "", {
          id: "cliente",
          header: "Cliente",
          cell: ({ getValue }) => <span className="line-clamp-1">{getValue()}</span>,
          sortFn: (a, b, id) => String(a.getValue(id)).localeCompare(String(b.getValue(id)), "it"),
        }),
        ...(multiUtente
          ? [
              col.accessor((t) => (t.assegnata_a ? (nomeUtente.get(t.assegnata_a) ?? "") : ""), {
                id: "assegnata",
                header: "Assegnata a",
              }),
            ]
          : []),
        col.accessor("completata_il", {
          header: "Completata",
          cell: ({ getValue }) => {
            const v = getValue();
            return v ? <span className="whitespace-nowrap text-muted-foreground">{formatDate(v)}</span> : null;
          },
          sortFn: (a, b) => (b.original.completata_il ?? "").localeCompare(a.original.completata_il ?? ""),
        }),
        col.display({
          id: "azioni",
          header: () => <span className="sr-only">Azioni</span>,
          cell: ({ row }) => <EliminaInTabella task={row.original} />,
        }),
      ]),
    [oggi, multiUtente, nomeUtente],
  );

  const table = useTable({ features, columns, data: filtrate });

  const selettori: { key: keyof Filtri; label: string; items: { value: string; label: string }[]; neutro?: string }[] = [
    {
      key: "stato",
      label: "Stato",
      neutro: "aperte",
      items: [
        { value: "aperte", label: "Da completare" },
        ...STATI_TASK.map((s) => ({ value: s.value, label: s.label })),
        { value: TUTTI, label: "Tutti" },
      ],
    },
    {
      key: "priorita",
      label: "Priorità",
      items: [
        { value: TUTTI, label: "Tutte" },
        ...PRIORITA.map((p) => ({ value: String(p.value), label: p.label })),
        { value: "nessuna", label: "Senza priorità" },
      ],
    },
    ...(filtroAmbito === "tutto"
      ? [
          {
            key: "ambito" as const,
            label: "Ambito",
            items: [
              { value: TUTTI, label: "Entrambi" },
              { value: "lavoro", label: "Lavoro" },
              { value: "personale", label: "Personale" },
            ],
          },
        ]
      : []),
    {
      key: "progetto",
      label: "Progetto",
      items: [
        { value: TUTTI, label: "Tutti" },
        { value: "nessuno", label: "Senza progetto" },
        ...(opzioni?.progetti ?? []).map((p) => ({ value: p.id, label: p.nome })),
      ],
    },
    {
      key: "cliente",
      label: "Cliente",
      items: [
        { value: TUTTI, label: "Tutti" },
        { value: "nessuno", label: "Senza cliente" },
        ...(opzioni?.clienti ?? []).map((c) => ({ value: c.id, label: c.nome })),
      ],
    },
    ...(multiUtente
      ? [
          {
            key: "assegnata" as const,
            label: "Assegnata a",
            items: [
              { value: TUTTI, label: "Chiunque" },
              { value: "nessuno", label: "Non assegnata" },
              ...(opzioni?.utenti ?? []).map((u) => ({ value: u.id, label: u.nome })),
            ],
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-4">
      <BarraFiltri
        ricerca={<CampoRicerca value={filtri.testo} onChange={(v) => set({ testo: v })} placeholder="Cerca nelle task…" label="Cerca nelle task" />}
        azzera={filtriAttivi ? () => setFiltri(FILTRI_INIZIALI) : null}
      >
        {selettori.map((s) => (
          <FiltroChip key={s.key} label={s.label} value={filtri[s.key]} onChange={(v) => set({ [s.key]: v })} opzioni={s.items} neutro={s.neutro} />
        ))}
      </BarraFiltri>

      {isPending ? (
        <ListaSkeleton />
      ) : filtrate.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">Nessuna task corrisponde ai filtri.</p>
      ) : (
        <>
          <div className="rounded-xl bg-card px-1 py-1 ring-1 ring-black/8 md:hidden">
            <ListaTask tasks={table.getRowModel().rows.map((r) => r.original)} />
          </div>
          <div className="hidden overflow-hidden rounded-xl bg-card shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-black/8 md:block">
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((hg) => (
                  <TableRow key={hg.id}>
                    {hg.headers.map((header) => (
                      <TableHead key={header.id}>
                        {header.column.getCanSort() ? (
                          <button
                            type="button"
                            onClick={header.column.getToggleSortingHandler()}
                            className="inline-flex items-center gap-1 hover:text-foreground"
                          >
                            <table.FlexRender header={header} />
                            <ArrowUpDown className="size-3" />
                          </button>
                        ) : (
                          <table.FlexRender header={header} />
                        )}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    {...(selezione ? attributiSelezione(row.original.id) : {})}
                    data-state={selezione?.selezionate.has(row.original.id) ? "selected" : undefined}
                    className={cn("group cursor-pointer", selezione?.attiva && "select-none")}
                    onClick={(e) =>
                      selezione?.attiva
                        ? selezione.toggle(row.original.id, { intervallo: e.shiftKey })
                        : apri({ tipo: "task", id: row.original.id })
                    }
                  >
                    {row.getAllCells().map((cell) => (
                      <TableCell
                        key={cell.id}
                        className={cn(cell.column.id === "titolo" && "max-w-md whitespace-normal", cell.column.id === "azioni" && "w-10 py-0 pr-2")}
                      >
                        <table.FlexRender cell={cell} />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <p className="text-xs text-muted-foreground">
            {filtrate.length === 1 ? "1 task" : `${filtrate.length} task`}
            {(data?.length ?? 0) >= 1000 && " · mostrate le 1000 più recenti"}
          </p>
        </>
      )}
    </div>
  );
}

/** Nella tabella: la spunta tonda, o la casella quadrata in modalità selezione. */
function SpuntaOSelezione({ task }: { task: TaskLista }) {
  const selezione = useSelezione();
  return selezione?.attiva ? (
    <CasellaSelezione id={task.id} etichetta={task.titolo} className="mt-0.5" />
  ) : (
    <TaskCheckbox task={task} className="mt-0.5" />
  );
}

function EliminaInTabella({ task }: { task: TaskLista }) {
  const selezione = useSelezione();
  return selezione?.attiva ? null : <EliminaTaskButton task={task} />;
}
