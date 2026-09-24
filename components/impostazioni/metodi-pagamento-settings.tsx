"use client";

import { Archive, ArchiveRestore, Loader2, Pencil, Plus, Trash2, WalletCards } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { ConfirmDialog, useConfirm } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { deleteMetodoPagamento, saveMetodoPagamento, setMetodoArchiviato } from "@/lib/actions/metodi-pagamento";
import { etichettaMetodo, TIPI_METODO, tipoMetodo, type TipoMetodo } from "@/lib/metodi-pagamento";
import type { MetodoPagamentoFormValues } from "@/lib/schemas/servizi";
import { cn } from "@/lib/utils";

export type MetodoPagamento = {
  id: string;
  nome: string;
  tipo: TipoMetodo;
  ultime_cifre: string | null;
  ambito: "lavoro" | "personale" | "entrambi";
  colore: string | null;
  archiviato: boolean;
  servizi: number;
};

const AMBITI = [
  { value: "entrambi", label: "Lavoro e personale" },
  { value: "lavoro", label: "Solo lavoro" },
  { value: "personale", label: "Solo personale" },
] as const;

export function MetodiPagamentoSettings({ metodi }: { metodi: MetodoPagamento[] }) {
  const [editing, setEditing] = useState<MetodoPagamento | "nuovo" | null>(null);
  const [mostraArchiviati, setMostraArchiviati] = useState(false);
  const conferma = useConfirm<MetodoPagamento>();
  const [, startTransition] = useTransition();
  const archiviati = metodi.filter((m) => m.archiviato).length;
  const visibili = metodi.filter((m) => mostraArchiviati || !m.archiviato);

  function archivia(m: MetodoPagamento, archiviato: boolean) {
    startTransition(async () => {
      const result = await setMetodoArchiviato(m.id, archiviato);
      if (!result.ok) toast.error(result.error);
      else toast.success(archiviato ? `${m.nome} archiviato: non compare più nelle scelte` : `${m.nome} ripristinato`);
    });
  }

  return (
    <Card id="metodi-pagamento" className="scroll-mt-20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <WalletCards className="size-4" />
          Metodi di pagamento
        </CardTitle>
        <CardDescription>
          Le carte e gli altri metodi con cui paghi. Li scegli quando inserisci un servizio o una spesa: dalla sezione
          Budget vedrai quanto hai speso con ciascuno. Salva solo le ultime 4 cifre, mai il numero completo.
        </CardDescription>
        <CardAction>
          <Button size="sm" onClick={() => setEditing("nuovo")}>
            <Plus />
            Aggiungi
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-3">
        <ul className="divide-y rounded-md ring-1 ring-foreground/10">
          {visibili.map((m) => {
            const Tipo = tipoMetodo(m.tipo).icon;
            return (
              <li key={m.id} className={cn("flex items-center gap-3 px-3 py-2.5", m.archiviato && "opacity-60")}>
                <Tipo className="size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{etichettaMetodo(m)}</p>
                  <p className="text-xs text-muted-foreground">
                    {tipoMetodo(m.tipo).label}
                    {m.ambito !== "entrambi" && ` · solo ${m.ambito}`}
                    {m.servizi > 0 && ` · ${m.servizi} ${m.servizi === 1 ? "servizio" : "servizi"}`}
                    {m.archiviato && " · archiviato"}
                  </p>
                </div>
                <Button variant="ghost" size="icon-xs" onClick={() => setEditing(m)} aria-label={`Modifica ${m.nome}`}>
                  <Pencil />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => archivia(m, !m.archiviato)}
                  aria-label={m.archiviato ? `Ripristina ${m.nome}` : `Archivia ${m.nome}`}
                >
                  {m.archiviato ? <ArchiveRestore /> : <Archive />}
                </Button>
                <Button variant="ghost" size="icon-xs" onClick={() => conferma.ask(m)} aria-label={`Elimina ${m.nome}`}>
                  <Trash2 />
                </Button>
              </li>
            );
          })}
        </ul>
        {archiviati > 0 && (
          <button
            type="button"
            className="text-xs text-muted-foreground underline underline-offset-4"
            onClick={() => setMostraArchiviati((v) => !v)}
          >
            {mostraArchiviati ? "Nascondi gli archiviati" : `Mostra gli archiviati (${archiviati})`}
          </button>
        )}
      </CardContent>

      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing === "nuovo" ? "Nuovo metodo di pagamento" : "Modifica metodo di pagamento"}</DialogTitle>
          </DialogHeader>
          {editing !== null && (
            <MetodoForm metodo={editing === "nuovo" ? null : editing} onDone={() => setEditing(null)} />
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={conferma.open}
        onOpenChange={conferma.onOpenChange}
        title={`Eliminare "${conferma.target?.nome ?? ""}"?`}
        description="Si può eliminare solo se non è mai stato usato. Altrimenti archivialo."
        onConfirm={async () => {
          if (!conferma.target) return;
          const result = await deleteMetodoPagamento(conferma.target.id);
          if (!result.ok) {
            toast.error(result.error);
            return false;
          }
          toast.success("Metodo eliminato");
        }}
      />
    </Card>
  );
}

function MetodoForm({ metodo, onDone }: { metodo: MetodoPagamento | null; onDone: () => void }) {
  const [valori, setValori] = useState<MetodoPagamentoFormValues>({
    nome: metodo?.nome ?? "",
    tipo: metodo?.tipo ?? "carta_credito",
    ultime_cifre: metodo?.ultime_cifre ?? "",
    ambito: metodo?.ambito ?? "entrambi",
    colore: metodo?.colore ?? "",
  });
  const [errori, setErrori] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();
  const conCifre = valori.tipo === "carta_credito" || valori.tipo === "carta_debito" || valori.tipo === "prepagata";
  const set = <K extends keyof MetodoPagamentoFormValues>(k: K, v: MetodoPagamentoFormValues[K]) =>
    setValori((prev) => ({ ...prev, [k]: v }));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await saveMetodoPagamento(metodo?.id ?? null, valori);
      if (!result.ok) {
        setErrori(result.fieldErrors ?? {});
        toast.error(result.error);
        return;
      }
      toast.success(metodo ? "Metodo aggiornato" : "Metodo aggiunto");
      onDone();
    });
  }

  return (
    <form onSubmit={submit} noValidate>
      <FieldGroup className="gap-4">
        <Field data-invalid={Boolean(errori.nome) || undefined}>
          <FieldLabel htmlFor="metodo-nome">Nome</FieldLabel>
          <Input
            id="metodo-nome"
            value={valori.nome}
            onChange={(e) => set("nome", e.target.value)}
            placeholder="es. Revolut, Visa Intesa, Carta aziendale"
            autoFocus
          />
          <FieldError>{errori.nome}</FieldError>
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel>Tipo</FieldLabel>
            <Select items={TIPI_METODO} value={valori.tipo} onValueChange={(v) => v && set("tipo", v as TipoMetodo)}>
              <SelectTrigger className="w-full" aria-label="Tipo">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIPI_METODO.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    <t.icon />
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          {conCifre && (
            <Field data-invalid={Boolean(errori.ultime_cifre) || undefined}>
              <FieldLabel htmlFor="metodo-cifre">Ultime 4 cifre</FieldLabel>
              <Input
                id="metodo-cifre"
                value={valori.ultime_cifre}
                onChange={(e) => set("ultime_cifre", e.target.value.replace(/\D/g, "").slice(0, 4))}
                inputMode="numeric"
                placeholder="4417"
                maxLength={4}
              />
              <FieldError>{errori.ultime_cifre}</FieldError>
            </Field>
          )}
        </div>
        <Field>
          <FieldLabel>Uso</FieldLabel>
          <Select items={AMBITI} value={valori.ambito} onValueChange={(v) => v && set("ambito", v)}>
            <SelectTrigger className="w-full" aria-label="Uso">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {AMBITI.map((a) => (
                <SelectItem key={a.value} value={a.value}>
                  {a.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldDescription>Un metodo &quot;solo personale&quot; non è mai visibile ai collaboratori.</FieldDescription>
        </Field>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onDone} disabled={pending}>
            Annulla
          </Button>
          <Button type="submit" disabled={pending || !valori.nome.trim()}>
            {pending && <Loader2 className="animate-spin" />}
            {metodo ? "Salva" : "Aggiungi"}
          </Button>
        </div>
      </FieldGroup>
    </form>
  );
}
