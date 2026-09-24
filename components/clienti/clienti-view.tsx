"use client";

import {
  createColumnHelper,
  createSortedRowModel,
  rowSortingFeature,
  tableFeatures,
  useTable,
} from "@tanstack/react-table";
import { ArrowUpDown, Building2, LayoutGrid, Plus, Rows3 } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

import { EmptyState } from "@/components/empty-state";
import { BarraFiltri, CampoRicerca } from "@/components/filtri/barra-filtri";
import { FiltroChip } from "@/components/filtri/filtro-chip";
import { Segmented } from "@/components/segmented";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { nomeCliente, STATI_CLIENTE, type StatoCliente } from "@/lib/clienti";
import type { ClienteLista } from "@/lib/queries/clienti";
import { useLocalPreference } from "@/lib/use-local-preference";
import { cn } from "@/lib/utils";

import { ClienteDialog } from "./cliente-dialog";
import { ClienteLogo } from "./cliente-logo";
import { StatoClienteBadge } from "./stato-badge";

type Vista = "tabella" | "card";
const VISTA_KEY = "clienti.vista";

// Filtro di default: tutti tranne gli archiviati.
const FILTRI_STATO = [
  { value: "correnti", label: "Non archiviati" },
  ...STATI_CLIENTE.map((s) => ({ value: s.value, label: s.label })),
  { value: "tutti", label: "Tutti" },
];

const features = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
});
const col = createColumnHelper<typeof features, ClienteLista>();

export function ClientiView({
  clienti,
  tags,
  puoCreare,
}: {
  clienti: ClienteLista[];
  tags: string[];
  puoCreare: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [query, setQuery] = useState("");
  const [stato, setStato] = useState("correnti");
  const [tag, setTag] = useState<string | null>(null);
  const [vista, cambiaVista] = useLocalPreference<Vista>(VISTA_KEY, ["tabella", "card"], "tabella");
  const creaAperto = puoCreare && searchParams.get("nuovo") === "1";

  function setCreaAperto(open: boolean) {
    const params = new URLSearchParams(searchParams.toString());
    if (open) params.set("nuovo", "1");
    else params.delete("nuovo");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  const filtrati = useMemo(() => {
    const q = query.trim().toLowerCase();
    return clienti.filter((c) => {
      if (stato === "correnti" && c.stato === "archiviato") return false;
      if (stato !== "correnti" && stato !== "tutti" && c.stato !== stato) return false;
      if (tag && !(c.tags ?? []).includes(tag)) return false;
      if (!q) return true;
      return [c.ragione_sociale, c.nome_breve, c.piva, c.email, c.citta]
        .some((v) => v?.toLowerCase().includes(q));
    });
  }, [clienti, query, stato, tag]);

  const columns = useMemo(
    () =>
      col.columns([
      col.accessor((c) => nomeCliente({ nome_breve: c.nome_breve, ragione_sociale: c.ragione_sociale ?? "" }), {
        id: "nome",
        header: "Cliente",
        cell: ({ row }) => <NomeCella cliente={row.original} />,
        sortFn: (a, b, id) => String(a.getValue(id)).localeCompare(String(b.getValue(id)), "it"),
      }),
      col.accessor("stato", {
        header: "Stato",
        cell: ({ getValue }) => {
          const s = getValue();
          return s ? <StatoClienteBadge stato={s} /> : null;
        },
      }),
      col.accessor("servizi_attivi", {
        header: "Servizi attivi",
        cell: ({ getValue }) => <span className="tabular-nums">{getValue() ?? 0}</span>,
      }),
      col.accessor("task_aperte", {
        header: "Task aperte",
        cell: ({ getValue }) => <span className="tabular-nums">{getValue() ?? 0}</span>,
      }),
      col.accessor("tags", {
        header: "Tag",
        enableSorting: false,
        cell: ({ getValue }) => <TagList tags={getValue() ?? []} />,
      }),
      ]),
    [],
  );

  const table = useTable({ features, columns, data: filtrati });

  const dialog = (
    <ClienteDialog
      open={creaAperto}
      onOpenChange={setCreaAperto}
      tagSuggestions={tags}
      onSaved={(id) => router.push(`/clienti/${id}`)}
    />
  );

  if (clienti.length === 0) {
    return (
      <>
        <EmptyState
          icon={Building2}
          title="Nessun cliente"
          description={
            puoCreare
              ? "Aggiungi il primo cliente: parti dalla partita IVA e VIES compila il resto."
              : "Non ci sono clienti assegnati al tuo account."
          }
          action={
            puoCreare && (
              <Button onClick={() => setCreaAperto(true)}>
                <Plus />
                Aggiungi il primo cliente
              </Button>
            )
          }
        />
        {dialog}
      </>
    );
  }

  return (
    <div className="space-y-4">
      <BarraFiltri
        ricerca={<CampoRicerca value={query} onChange={setQuery} placeholder="Cerca per nome, P.IVA, email, città…" label="Cerca clienti" />}
        destra={
          <>
            <Segmented
              label="Vista"
              value={vista}
              onChange={cambiaVista}
              soloIcone="mobile"
              opzioni={[
                { value: "tabella", label: "Tabella", icon: Rows3 },
                { value: "card", label: "Card", icon: LayoutGrid },
              ]}
              className="hidden md:block [&>p]:sr-only"
            />
            {puoCreare && (
              <Button className="hidden rounded-full sm:inline-flex" onClick={() => setCreaAperto(true)}>
                <Plus />
                Nuovo cliente
              </Button>
            )}
          </>
        }
        azzera={
          stato !== "correnti" || tag !== null || query !== ""
            ? () => {
                setStato("correnti");
                setTag(null);
                setQuery("");
              }
            : null
        }
      >
        <FiltroChip label="Stato" value={stato} onChange={setStato} opzioni={FILTRI_STATO} />
        {tags.length > 0 && (
          <FiltroChip
            label="Tag"
            value={tag ?? ""}
            onChange={(v) => setTag(v || null)}
            opzioni={[{ value: "", label: "Tutti" }, ...tags.map((t) => ({ value: t, label: t }))]}
          />
        )}
      </BarraFiltri>

      {filtrati.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">Nessun cliente corrisponde ai filtri.</p>
      ) : (
        <>
          {/* Su mobile sempre card; da md in su la vista scelta. */}
          <div className={cn("grid gap-3 sm:grid-cols-2 xl:grid-cols-3", vista === "tabella" && "md:hidden")}>
            {table.getRowModel().rows.map((row) => (
              <ClienteCard key={row.id} cliente={row.original} />
            ))}
          </div>
          {vista === "tabella" && (
            <div className="hidden overflow-hidden rounded-2xl bg-card shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-black/8 md:block">
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
                    <TableRow key={row.id} className="cursor-pointer" onClick={() => router.push(`/clienti/${row.original.id}`)}>
                      {row.getAllCells().map((cell) => (
                        <TableCell key={cell.id}>
                          <table.FlexRender cell={cell} />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </>
      )}
      {dialog}
    </div>
  );
}

function NomeCella({ cliente }: { cliente: ClienteLista }) {
  const nome = nomeCliente({ nome_breve: cliente.nome_breve, ragione_sociale: cliente.ragione_sociale ?? "" });
  return (
    <Link href={`/clienti/${cliente.id}`} className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
      <ClienteLogo nome={nome} colore={cliente.colore} logoUrl={cliente.logo_url} sito={cliente.sito} size="sm" />
      <span className="min-w-0">
        <span className="block truncate font-medium">{nome}</span>
        {cliente.nome_breve && (
          <span className="block truncate text-xs text-muted-foreground">{cliente.ragione_sociale}</span>
        )}
      </span>
    </Link>
  );
}

function ClienteCard({ cliente }: { cliente: ClienteLista }) {
  const nome = nomeCliente({ nome_breve: cliente.nome_breve, ragione_sociale: cliente.ragione_sociale ?? "" });
  return (
    <Link
      href={`/clienti/${cliente.id}`}
      className="flex flex-col gap-3 rounded-2xl bg-card p-4 ring-1 ring-black/8 transition-shadow hover:shadow-md"
    >
      <div className="flex items-center gap-3">
        <ClienteLogo nome={nome} colore={cliente.colore} logoUrl={cliente.logo_url} sito={cliente.sito} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{nome}</p>
          {cliente.citta && <p className="truncate text-xs text-muted-foreground">{cliente.citta}</p>}
          {cliente.stato && <StatoClienteBadge stato={cliente.stato as StatoCliente} className="mt-1" />}
        </div>
      </div>
      <div className="flex gap-4 text-xs text-muted-foreground">
        <span>
          <strong className="text-foreground tabular-nums">{cliente.servizi_attivi ?? 0}</strong> servizi attivi
        </span>
        <span>
          <strong className="text-foreground tabular-nums">{cliente.task_aperte ?? 0}</strong> task aperte
        </span>
      </div>
      <TagList tags={cliente.tags ?? []} />
    </Link>
  );
}

function TagList({ tags }: { tags: string[] }) {
  if (tags.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {tags.map((t) => (
        <span key={t} className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
          {t}
        </span>
      ))}
    </div>
  );
}
