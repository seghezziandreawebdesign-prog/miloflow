"use client";

import { CalendarPlus, Globe, Pause, Pencil, Play, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { Segmented } from "@/components/segmented";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  deleteCalendarioEsterno,
  saveCalendarioEsterno,
  sincronizzaCalendariEsterni,
  type CalendarioEsternoInput,
} from "@/lib/actions/calendari-esterni";
import { COLORI } from "@/lib/colori";
import { formatDate, formatTime } from "@/lib/dates/format";
import { cn } from "@/lib/utils";

export type CalendarioEsternoRiga = {
  id: string;
  nome: string;
  url: string;
  colore: string | null;
  ambito: "lavoro" | "personale";
  attivo: boolean;
  ultimo_sync: string | null;
  errore_sync: string | null;
};

const AMBITI = [
  { value: "lavoro", label: "Lavoro" },
  { value: "personale", label: "Personale" },
] as const;

export function CalendariEsterniSettings({ calendari }: { calendari: CalendarioEsternoRiga[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<CalendarioEsternoRiga | "nuovo" | null>(null);
  const [daEliminare, setDaEliminare] = useState<CalendarioEsternoRiga | null>(null);
  const [syncing, startSync] = useTransition();
  const [, startTransition] = useTransition();

  function sincronizzaTutti() {
    startSync(async () => {
      const result = await sincronizzaCalendariEsterni({ forza: true });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      for (const errore of result.data.errori) toast.error(errore);
      if (result.data.errori.length === 0) {
        toast.success(result.data.sincronizzati === 1 ? "Calendario sincronizzato" : `${result.data.sincronizzati} calendari sincronizzati`);
      }
      router.refresh();
    });
  }

  function attivaSospendi(c: CalendarioEsternoRiga) {
    startTransition(async () => {
      const result = await saveCalendarioEsterno(c.id, {
        nome: c.nome,
        url: c.url,
        colore: c.colore ?? "",
        ambito: c.ambito,
        attivo: !c.attivo,
      });
      if (!result.ok) toast.error(result.error);
      else toast.success(c.attivo ? "Calendario sospeso: gli eventi restano nascosti" : "Calendario riattivato");
      router.refresh();
    });
  }

  return (
    <Card id="calendari-esterni">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="size-4" />
          Calendari esterni
        </CardTitle>
        <CardDescription>
          Feed ICS in sola lettura, per esempio il calendario condiviso della famiglia. Su iCloud.com apri il calendario, attiva
          «Calendario pubblico» e incolla qui il link webcal. Gli eventi si aggiornano all&apos;apertura del calendario (al più una
          volta all&apos;ora) o con «Sincronizza ora».
        </CardDescription>
        <CardAction>
          <Button size="sm" onClick={() => setEditing("nuovo")}>
            <Plus />
            Aggiungi
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-3">
        {calendari.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nessun calendario esterno.{" "}
            <button type="button" className="text-foreground underline underline-offset-4" onClick={() => setEditing("nuovo")}>
              Aggiungi il primo
            </button>
          </p>
        ) : (
          <>
            <ul className="divide-y">
              {calendari.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 py-2.5">
                  <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: c.colore ?? "var(--muted-foreground)" }} />
                  <span className={cn("font-medium", !c.attivo && "text-muted-foreground line-through")}>{c.nome}</span>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-xs",
                      c.ambito === "personale" ? "bg-ambito-personale-soft text-ambito-personale" : "bg-ambito-lavoro-soft text-ambito-lavoro",
                    )}
                  >
                    {c.ambito === "personale" ? "Personale" : "Lavoro"}
                  </span>
                  <span className="ml-auto flex items-center gap-0.5">
                    <Button variant="ghost" size="icon-xs" aria-label={`Modifica ${c.nome}`} onClick={() => setEditing(c)}>
                      <Pencil />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label={c.attivo ? `Sospendi ${c.nome}` : `Riattiva ${c.nome}`}
                      onClick={() => attivaSospendi(c)}
                    >
                      {c.attivo ? <Pause /> : <Play />}
                    </Button>
                    <Button variant="ghost" size="icon-xs" aria-label={`Elimina ${c.nome}`} onClick={() => setDaEliminare(c)}>
                      <Trash2 />
                    </Button>
                  </span>
                  <span className="w-full text-xs text-muted-foreground">
                    {c.errore_sync ? (
                      <span className="text-destructive">Errore: {c.errore_sync}</span>
                    ) : c.ultimo_sync ? (
                      `Sincronizzato il ${formatDate(c.ultimo_sync)} alle ${formatTime(c.ultimo_sync)}`
                    ) : (
                      "Mai sincronizzato"
                    )}
                  </span>
                </li>
              ))}
            </ul>
            <Button type="button" variant="outline" size="sm" disabled={syncing} onClick={sincronizzaTutti}>
              <RefreshCw className={syncing ? "animate-spin" : undefined} />
              {syncing ? "Sincronizzo…" : "Sincronizza ora"}
            </Button>
          </>
        )}
      </CardContent>

      {editing !== null && (
        <CalendarioEsternoDialog
          calendario={editing === "nuovo" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            router.refresh();
          }}
        />
      )}
      <ConfirmDialog
        open={daEliminare !== null}
        onOpenChange={(o) => !o && setDaEliminare(null)}
        title={`Eliminare «${daEliminare?.nome ?? ""}»?`}
        description="Gli eventi di questo calendario spariscono da Milo Flow. Il calendario originale non viene toccato."
        onConfirm={async () => {
          if (!daEliminare) return;
          const result = await deleteCalendarioEsterno(daEliminare.id);
          if (!result.ok) {
            toast.error(result.error);
            return false;
          }
          toast.success("Calendario esterno eliminato");
          router.refresh();
        }}
      />
    </Card>
  );
}

function CalendarioEsternoDialog({
  calendario,
  onClose,
  onSaved,
}: {
  calendario: CalendarioEsternoRiga | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [nome, setNome] = useState(calendario?.nome ?? "");
  const [url, setUrl] = useState(calendario?.url ?? "");
  const [colore, setColore] = useState(calendario?.colore ?? "");
  const [ambito, setAmbito] = useState<"lavoro" | "personale">(calendario?.ambito ?? "personale");
  const [errori, setErrori] = useState<Record<string, string>>({});
  const [saving, startSaving] = useTransition();

  function salva(e: React.FormEvent) {
    e.preventDefault();
    startSaving(async () => {
      const input: CalendarioEsternoInput = { nome, url, colore, ambito, attivo: calendario?.attivo ?? true };
      const result = await saveCalendarioEsterno(calendario?.id ?? null, input);
      setErrori(result.ok ? {} : (result.fieldErrors ?? {}));
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(calendario ? "Calendario aggiornato" : "Calendario aggiunto e sincronizzato");
      onSaved();
    });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarPlus className="size-4" />
            {calendario ? "Modifica calendario esterno" : "Nuovo calendario esterno"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={salva} noValidate className="space-y-5">
          <FieldGroup className="gap-4">
            <Field data-invalid={Boolean(errori.nome) || undefined}>
              <FieldLabel htmlFor="cal-est-nome">Nome</FieldLabel>
              <Input id="cal-est-nome" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="es. Famiglia" autoFocus />
              <FieldError>{errori.nome}</FieldError>
            </Field>
            <Field data-invalid={Boolean(errori.url) || undefined}>
              <FieldLabel htmlFor="cal-est-url">Link del feed (webcal o https)</FieldLabel>
              <Input
                id="cal-est-url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="webcal://p137-caldav.icloud.com/published/…"
                inputMode="url"
              />
              <FieldError>{errori.url}</FieldError>
            </Field>
            <Segmented label="Ambito" value={ambito} onChange={setAmbito} opzioni={AMBITI} />
            <div className="space-y-2">
              <p className="text-sm font-medium">Colore</p>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Colore">
                <button
                  type="button"
                  role="radio"
                  aria-checked={!colore}
                  aria-label="Nessun colore"
                  onClick={() => setColore("")}
                  className={cn(
                    "size-7 rounded-full border bg-background text-xs text-muted-foreground",
                    !colore && "ring-2 ring-ring ring-offset-2",
                  )}
                >
                  –
                </button>
                {COLORI.map((c) => (
                  <button
                    key={c}
                    type="button"
                    role="radio"
                    aria-checked={colore === c}
                    aria-label={c}
                    onClick={() => setColore(c)}
                    className={cn("size-7 rounded-full", colore === c && "ring-2 ring-ring ring-offset-2")}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          </FieldGroup>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Annulla
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Sincronizzo…" : calendario ? "Salva" : "Aggiungi e sincronizza"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
