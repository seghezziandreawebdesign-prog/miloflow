"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { CategoriaIcona } from "@/components/budget/categoria-icona";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { saveCategoria } from "@/lib/actions/budget";
import { AMBITI_CATEGORIA, type Categoria } from "@/lib/budget";
import { NOMI_ICONE_CATEGORIE } from "@/lib/icone";
import { categoriaVuota, type CategoriaFormValues } from "@/lib/schemas/budget";
import { cn } from "@/lib/utils";

const COLORI = ["#2563eb", "#0891b2", "#16a34a", "#ca8a04", "#ea580c", "#dc2626", "#db2777", "#9333ea", "#7c3aed", "#475569", "#0f766e", "#b45309"];

export function CategoriaDialog({
  open,
  onOpenChange,
  categoria,
  parentId,
  ambitoIniziale,
  padri,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categoria: Categoria | null;
  parentId: string;
  ambitoIniziale: Categoria["ambito"];
  padri: Categoria[];
}) {
  const [v, setV] = useState<CategoriaFormValues>(
    categoria
      ? {
          nome: categoria.nome,
          parent_id: categoria.parent_id ?? "",
          ambito: categoria.ambito,
          colore: categoria.colore ?? "",
          icona: categoria.icona ?? "",
          budget_default: categoria.budget_default === null ? "" : String(categoria.budget_default).replace(".", ","),
        }
      : categoriaVuota(parentId, ambitoIniziale),
  );
  const [errori, setErrori] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const set = <K extends keyof CategoriaFormValues>(k: K, val: CategoriaFormValues[K]) => setV((x) => ({ ...x, [k]: val }));
  const padreScelto = padri.find((p) => p.id === v.parent_id);
  // Una categoria con figlie non può diventare sottocategoria: il database lo rifiuta comunque.
  const itemsPadri = [{ value: "", label: "Nessuna: è una categoria principale" }, ...padri.filter((p) => p.id !== categoria?.id).map((p) => ({ value: p.id, label: p.nome }))];

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await saveCategoria(categoria?.id ?? null, v);
      if (!result.ok) {
        setErrori(result.fieldErrors ?? {});
        toast.error(result.error);
        return;
      }
      toast.success(categoria ? "Categoria aggiornata" : "Categoria creata");
      router.refresh();
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{categoria ? "Modifica categoria" : v.parent_id ? "Nuova sottocategoria" : "Nuova categoria"}</DialogTitle>
          <DialogDescription>Nome, icona e colore la rendono riconoscibile nella griglia delle spese.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} noValidate>
          <FieldGroup className="gap-4">
            <div className="flex items-start gap-3">
              <CategoriaIcona nome={v.icona} colore={v.colore || padreScelto?.colore} size="lg" className="mt-5" />
              <Field className="flex-1" data-invalid={Boolean(errori.nome) || undefined}>
                <FieldLabel htmlFor="categoria-nome">Nome</FieldLabel>
                <Input id="categoria-nome" value={v.nome} onChange={(e) => set("nome", e.target.value)} autoFocus />
                <FieldError>{errori.nome}</FieldError>
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel>Dentro a</FieldLabel>
                <Select items={itemsPadri} value={v.parent_id} onValueChange={(p) => set("parent_id", String(p ?? ""))}>
                  <SelectTrigger className="w-full" aria-label="Categoria padre">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {itemsPadri.map((i) => (
                      <SelectItem key={i.value} value={i.value}>
                        {i.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel>Ambito</FieldLabel>
                <Select items={AMBITI_CATEGORIA} value={padreScelto ? padreScelto.ambito : v.ambito} onValueChange={(a) => a && set("ambito", a as CategoriaFormValues["ambito"])}>
                  <SelectTrigger className="w-full" aria-label="Ambito" disabled={Boolean(padreScelto)}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AMBITI_CATEGORIA.map((a) => (
                      <SelectItem key={a.value} value={a.value}>
                        {a.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {padreScelto && <FieldDescription>Come il padre.</FieldDescription>}
              </Field>
            </div>
            <Field data-invalid={Boolean(errori.budget_default) || undefined}>
              <FieldLabel htmlFor="categoria-budget">Budget mensile di default (€)</FieldLabel>
              <Input id="categoria-budget" value={v.budget_default} onChange={(e) => set("budget_default", e.target.value)} inputMode="decimal" placeholder="Nessuno" className="sm:w-48" />
              <FieldError>{errori.budget_default}</FieldError>
            </Field>
            <Field>
              <FieldLabel>Colore</FieldLabel>
              <div className="flex flex-wrap gap-2">
                {COLORI.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-label={c}
                    aria-pressed={v.colore === c}
                    onClick={() => set("colore", v.colore === c ? "" : c)}
                    className={cn("size-7 rounded-full ring-offset-2 transition-transform", v.colore === c && "scale-110 ring-2 ring-foreground/60")}
                    style={{ backgroundColor: c }}
                  />
                ))}
                <input type="color" value={v.colore || "#8e8e93"} onChange={(e) => set("colore", e.target.value)} aria-label="Colore personalizzato" className="size-7 cursor-pointer rounded-full border-0 bg-transparent p-0" />
              </div>
              <FieldError>{errori.colore}</FieldError>
            </Field>
            <Field>
              <FieldLabel>Icona</FieldLabel>
              <div className="grid max-h-40 grid-cols-8 gap-1 overflow-y-auto rounded-lg p-1 ring-1 ring-black/8 sm:grid-cols-10">
                {NOMI_ICONE_CATEGORIE.map((nome) => (
                  <button
                    key={nome}
                    type="button"
                    aria-label={nome}
                    aria-pressed={v.icona === nome}
                    onClick={() => set("icona", v.icona === nome ? "" : nome)}
                    className={cn("grid aspect-square place-items-center rounded-md hover:bg-muted", v.icona === nome && "bg-primary-soft text-primary")}
                  >
                    <CategoriaIcona nome={nome} colore={null} size="sm" className={cn("bg-transparent text-current", v.icona !== nome && "text-foreground")} />
                  </button>
                ))}
              </div>
            </Field>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
                Annulla
              </Button>
              <Button type="submit" disabled={pending}>
                {pending && <Loader2 className="animate-spin" />}
                Salva
              </Button>
            </div>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}
