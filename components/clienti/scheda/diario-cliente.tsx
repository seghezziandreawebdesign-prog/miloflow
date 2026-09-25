"use client";

import { NotebookPen, Pencil, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { ConfirmDialog, useConfirm } from "@/components/confirm-dialog";
import { DatePicker } from "@/components/date-picker";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { deleteNotaDiario, saveNotaDiario } from "@/lib/actions/clienti";
import { capitalize, formatDate, formatLongDate, todayISO } from "@/lib/dates/format";
import type { SchedaCliente } from "@/lib/queries/clienti";

import { useAggiornaScheda } from "./scheda-cliente";

type Nota = SchedaCliente["diario"][number];

export function DiarioCliente({ clienteId, note }: { clienteId: string; note: Nota[] }) {
  const [data, setData] = useState(todayISO());
  const [testo, setTesto] = useState("");
  const [pending, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);
  const conferma = useConfirm<Nota>();
  const aggiornaScheda = useAggiornaScheda();

  function aggiungi(e?: React.FormEvent) {
    e?.preventDefault();
    if (!testo.trim()) return;
    startTransition(async () => {
      const result = await saveNotaDiario(clienteId, { data, testo });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setTesto("");
      setData(todayISO());
      toast.success("Nota aggiunta al diario");
      aggiornaScheda();
    });
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <form onSubmit={aggiungi} className="space-y-2 rounded-xl bg-card p-3 ring-1 ring-black/8">
        <Textarea
          value={testo}
          onChange={(e) => setTesto(e.target.value)}
          placeholder="Cosa è successo? Chiamata, decisione, richiesta…"
          rows={3}
          aria-label="Nuova nota"
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) aggiungi();
          }}
        />
        <div className="flex items-center justify-between gap-2">
          <DatePicker value={data} onChange={setData} className="w-auto" />
          <Button type="submit" disabled={pending || !testo.trim()}>
            Aggiungi nota
          </Button>
        </div>
      </form>

      {note.length === 0 ? (
        <div className="flex flex-col items-center py-8 text-center text-sm text-muted-foreground">
          <NotebookPen className="mb-2 size-5" />
          Il diario è vuoto. Annota qui chiamate, decisioni e richieste del cliente.
        </div>
      ) : (
        <ol className="relative space-y-5 border-l pl-5">
          {note.map((n) => (
            <li key={n.id} className="group relative">
              <span className="absolute top-1.5 -left-[1.4rem] size-2 rounded-full bg-foreground/30" aria-hidden />
              <div className="flex items-center gap-2">
                <time dateTime={n.data} className="text-xs font-medium text-muted-foreground" title={formatDate(n.data)}>
                  {capitalize(formatLongDate(n.data))} {n.data.slice(0, 4) !== todayISO().slice(0, 4) && n.data.slice(0, 4)}
                </time>
                <div className="flex opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100">
                  <Button variant="ghost" size="icon-xs" onClick={() => setEditingId(n.id)} aria-label="Modifica nota">
                    <Pencil />
                  </Button>
                  <Button variant="ghost" size="icon-xs" onClick={() => conferma.ask(n)} aria-label="Elimina nota">
                    <Trash2 />
                  </Button>
                </div>
              </div>
              {editingId === n.id ? (
                <ModificaNota clienteId={clienteId} nota={n} onDone={() => setEditingId(null)} />
              ) : (
                <p className="mt-1 text-sm whitespace-pre-wrap">{n.testo}</p>
              )}
            </li>
          ))}
        </ol>
      )}

      <ConfirmDialog
        open={conferma.open}
        onOpenChange={conferma.onOpenChange}
        title="Eliminare questa nota?"
        description={conferma.target ? `Nota del ${formatDate(conferma.target.data)}.` : undefined}
        onConfirm={async () => {
          if (!conferma.target) return;
          const result = await deleteNotaDiario(clienteId, conferma.target.id);
          if (!result.ok) {
            toast.error(result.error);
            return false;
          }
          toast.success("Nota eliminata");
          aggiornaScheda();
        }}
      />
    </div>
  );
}

function ModificaNota({ clienteId, nota, onDone }: { clienteId: string; nota: Nota; onDone: () => void }) {
  const [data, setData] = useState(nota.data);
  const [testo, setTesto] = useState(nota.testo);
  const [pending, startTransition] = useTransition();
  const aggiornaScheda = useAggiornaScheda();

  function salva() {
    startTransition(async () => {
      const result = await saveNotaDiario(clienteId, { data, testo }, nota.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Nota aggiornata");
      aggiornaScheda();
      onDone();
    });
  }

  return (
    <div className="mt-2 space-y-2">
      <Textarea value={testo} onChange={(e) => setTesto(e.target.value)} rows={3} autoFocus aria-label="Testo della nota" />
      <div className="flex items-center justify-between gap-2">
        <DatePicker value={data} onChange={setData} className="w-auto" />
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={onDone} disabled={pending}>
            Annulla
          </Button>
          <Button size="sm" onClick={salva} disabled={pending || !testo.trim()}>
            Salva
          </Button>
        </div>
      </div>
    </div>
  );
}
