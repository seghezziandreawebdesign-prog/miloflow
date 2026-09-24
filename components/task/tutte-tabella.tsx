"use client";

import {
  createColumnHelper,
  createSortedRowModel,
  rowSortingFeature,
  tableFeatures,
  useTable,
} from "@tanstack/react-table";
import { ArrowUpDown, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { useApriEntita } from "@/components/drawer/use-apri-entita";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { FiltroAmbito } from "@/lib/ambito";
import { formatDate, todayISO } from "@/lib/dates/format";
import { normalizza } from "@/lib/parsing/task-rapida";
import { PRIORITA, priorita, statoTask, STATI_TASK } from "@/lib/task";
import { cn } from "@/lib/utils";

import { useOpzioniTask, useTaskArchivio, type TaskLista } from "./dati";
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

export function TutteTabella({ filtroAmbito }: { filtroAmbito: FiltroAmbito }) {
  const { data, isPending } = useTaskArchivio(filtroAmbito);
  const { data: opzioni } = useOpzioniTask();
  const apri = useApriEntita();
  const [filtri, setFiltri] = useState<Filtri>({
    testo: "",
    stato: "aperte",
    priorita: TUTTI,
    ambito: TUTTI,
    cliente: TUTTI,
    progetto: TUTTI,
    assegnata: TUTTI,
  });
  const set = (patch: Partial<Filtri>) => setFiltri((f) => ({ ...f, ...patch }));
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
      if (q && !normalizza(`${t.titolo} ${t.note ?? ""}`).includes(q)) return false;
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
              <TaskCheckbox task={row.original} className="mt-0.5" />
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
          header: "Quando",
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
      ]),
    [oggi, multiUtente, nomeUtente],
  );

  const table = useTable({ features, columns, data: filtrate });

  const selettori: { key: keyof Filtri; label: string; items: { value: string; label: string }[] }[] = [
    {
      key: "stato",
      label: "Stato",
      items: [
        { value: "aperte", label: "Da completare" },
        ...STATI_TASK.map((s) => ({ value: s.value, label: s.label })),
        { value: TUTTI, label: "Tutti gli stati" },
      ],
    },
    {
      key: "priorita",
      label: "Priorità",
      items: [
        { value: TUTTI, label: "Ogni priorità" },
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
              { value: TUTTI, label: "Lavoro e personale" },
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
        { value: TUTTI, label: "Ogni progetto" },
        { value: "nessuno", label: "Senza progetto" },
        ...(opzioni?.progetti ?? []).map((p) => ({ value: p.id, label: p.nome })),
      ],
    },
    {
      key: "cliente",
      label: "Cliente",
      items: [
        { value: TUTTI, label: "Ogni cliente" },
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
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={filtri.testo}
            onChange={(e) => set({ testo: e.target.value })}
            placeholder="Cerca nelle task…"
            aria-label="Cerca nelle task"
            className="pl-8"
          />
        </div>
        {selettori.map((s) => (
          <Select key={s.key} items={s.items} value={filtri[s.key]} onValueChange={(v) => v && set({ [s.key]: v })}>
            <SelectTrigger aria-label={s.label} className="max-w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {s.items.map((i) => (
                <SelectItem key={i.value} value={i.value}>
                  {i.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ))}
      </div>

      {isPending ? (
        <ListaSkeleton />
      ) : filtrate.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">Nessuna task corrisponde ai filtri.</p>
      ) : (
        <>
          <ListaTask tasks={table.getRowModel().rows.map((r) => r.original)} className="md:hidden" />
          <div className="hidden overflow-hidden rounded-xl ring-1 ring-foreground/10 md:block">
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
                    className="cursor-pointer"
                    onClick={() => apri({ tipo: "task", id: row.original.id })}
                  >
                    {row.getAllCells().map((cell) => (
                      <TableCell key={cell.id} className={cn(cell.column.id === "titolo" && "max-w-md whitespace-normal")}>
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
