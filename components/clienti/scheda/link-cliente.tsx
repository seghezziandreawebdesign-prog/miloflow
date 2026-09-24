"use client";

import { ArrowDown, ArrowUp, ExternalLink, Plus, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { ConfirmDialog, useConfirm } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { deleteLink, moveLink, saveLink } from "@/lib/actions/clienti";
import type { SchedaCliente } from "@/lib/queries/clienti";

type LinkRow = SchedaCliente["link"][number];

export function LinkCliente({ clienteId, link }: { clienteId: string; link: LinkRow[] }) {
  const [adding, setAdding] = useState(false);
  const [etichetta, setEtichetta] = useState("");
  const [url, setUrl] = useState("");
  const [pending, startTransition] = useTransition();
  const conferma = useConfirm<LinkRow>();

  function aggiungi(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await saveLink(clienteId, { etichetta, url });
      if (!result.ok) {
        toast.error(Object.values(result.fieldErrors ?? {})[0] ?? result.error);
        return;
      }
      setEtichetta("");
      setUrl("");
      setAdding(false);
      toast.success("Link aggiunto");
    });
  }

  function sposta(l: LinkRow, direzione: "su" | "giu") {
    startTransition(async () => {
      const result = await moveLink(clienteId, l.id, direzione);
      if (!result.ok) toast.error(result.error);
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Link</CardTitle>
        <CardAction>
          <Button variant="ghost" size="icon-sm" onClick={() => setAdding((v) => !v)} aria-label="Aggiungi link">
            <Plus />
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-3">
        {link.length === 0 && !adding && (
          <p className="text-sm text-muted-foreground">
            Nessun link: sito in staging, Drive, Figma, pannello…{" "}
            <button type="button" className="text-foreground underline underline-offset-4" onClick={() => setAdding(true)}>
              Aggiungine uno
            </button>
          </p>
        )}
        {link.length > 0 && (
          <ul className="-my-1">
            {link.map((l, i) => (
              <li key={l.id} className="group flex items-center gap-1 py-1">
                <a
                  href={l.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-w-0 flex-1 items-center gap-1.5 text-sm hover:underline"
                  title={l.url}
                >
                  <ExternalLink className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate">{l.etichetta}</span>
                </a>
                <div className="flex opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100">
                  <Button variant="ghost" size="icon-xs" disabled={i === 0 || pending} onClick={() => sposta(l, "su")} aria-label="Sposta su">
                    <ArrowUp />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    disabled={i === link.length - 1 || pending}
                    onClick={() => sposta(l, "giu")}
                    aria-label="Sposta giù"
                  >
                    <ArrowDown />
                  </Button>
                  <Button variant="ghost" size="icon-xs" onClick={() => conferma.ask(l)} aria-label={`Elimina ${l.etichetta}`}>
                    <Trash2 />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
        {adding && (
          <form onSubmit={aggiungi} className="space-y-2">
            <Input value={etichetta} onChange={(e) => setEtichetta(e.target.value)} placeholder="Etichetta" aria-label="Etichetta" autoFocus />
            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" aria-label="Indirizzo" />
            <div className="flex justify-end gap-2">
              <Button type="button" size="sm" variant="ghost" onClick={() => setAdding(false)}>
                Annulla
              </Button>
              <Button type="submit" size="sm" disabled={pending || !etichetta.trim() || !url.trim()}>
                Aggiungi
              </Button>
            </div>
          </form>
        )}
      </CardContent>
      <ConfirmDialog
        open={conferma.open}
        onOpenChange={conferma.onOpenChange}
        title={`Eliminare il link "${conferma.target?.etichetta ?? ""}"?`}
        onConfirm={async () => {
          if (!conferma.target) return;
          const result = await deleteLink(clienteId, conferma.target.id);
          if (!result.ok) {
            toast.error(result.error);
            return false;
          }
          toast.success("Link eliminato");
        }}
      />
    </Card>
  );
}
