"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Mail, Pencil, Phone, Plus, Star, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { Controller, useForm, type FieldPath } from "react-hook-form";
import { toast } from "sonner";

import { ConfirmDialog, useConfirm } from "@/components/confirm-dialog";
import { CopyButton } from "@/components/copy-button";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { deleteContatto, saveContatto, setContattoPrincipale } from "@/lib/actions/clienti";
import type { SchedaCliente } from "@/lib/queries/clienti";
import { contattoSchema, type ContattoFormValues } from "@/lib/schemas/clienti";
import { cn } from "@/lib/utils";

import { useAggiornaScheda } from "./scheda-cliente";

type Contatto = SchedaCliente["contatti"][number];

export function ContattiCliente({ clienteId, contatti }: { clienteId: string; contatti: Contatto[] }) {
  const [editing, setEditing] = useState<Contatto | "nuovo" | null>(null);
  const conferma = useConfirm<Contatto>();
  const aggiornaScheda = useAggiornaScheda();
  const [, startTransition] = useTransition();

  function rendiPrincipale(contatto: Contatto) {
    startTransition(async () => {
      const result = await setContattoPrincipale(clienteId, contatto.id);
      if (!result.ok) toast.error(result.error);
      else {
        toast.success(`${contatto.nome} è ora il contatto principale`);
        aggiornaScheda();
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Contatti</CardTitle>
        <CardAction>
          <Button variant="ghost" size="icon-sm" onClick={() => setEditing("nuovo")} aria-label="Aggiungi contatto">
            <Plus />
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {contatti.length === 0 ? (
          <div className="py-2 text-sm text-muted-foreground">
            Nessun contatto.{" "}
            <button type="button" className="text-foreground underline underline-offset-4" onClick={() => setEditing("nuovo")}>
              Aggiungi il primo
            </button>
          </div>
        ) : (
          <ul className="-my-2 divide-y">
            {contatti.map((c) => (
              <li key={c.id} className="group py-3">
                <div className="flex items-start gap-2">
                  <button
                    type="button"
                    onClick={() => !c.principale && rendiPrincipale(c)}
                    aria-label={c.principale ? "Contatto principale" : "Rendi principale"}
                    title={c.principale ? "Contatto principale" : "Rendi principale"}
                    className={cn("mt-0.5", c.principale ? "text-amber-500" : "text-muted-foreground/40 hover:text-amber-500")}
                  >
                    <Star className={cn("size-4", c.principale && "fill-current")} />
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{c.nome}</p>
                    {c.ruolo && <p className="text-xs text-muted-foreground">{c.ruolo}</p>}
                    {c.email && (
                      <p className="flex items-center gap-1 text-sm">
                        <Mail className="size-3.5 shrink-0 text-muted-foreground" />
                        <a href={`mailto:${c.email}`} className="truncate hover:underline">
                          {c.email}
                        </a>
                        <CopyButton value={c.email} label="Email" />
                      </p>
                    )}
                    {c.telefono && (
                      <p className="flex items-center gap-1 text-sm">
                        <Phone className="size-3.5 shrink-0 text-muted-foreground" />
                        <a href={`tel:${c.telefono.replace(/\s/g, "")}`} className="hover:underline">
                          {c.telefono}
                        </a>
                      </p>
                    )}
                  </div>
                  <div className="flex opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100">
                    <Button variant="ghost" size="icon-xs" onClick={() => setEditing(c)} aria-label={`Modifica ${c.nome}`}>
                      <Pencil />
                    </Button>
                    <Button variant="ghost" size="icon-xs" onClick={() => conferma.ask(c)} aria-label={`Elimina ${c.nome}`}>
                      <Trash2 />
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing === "nuovo" ? "Nuovo contatto" : "Modifica contatto"}</DialogTitle>
          </DialogHeader>
          {editing !== null && (
            <ContattoForm
              clienteId={clienteId}
              contatto={editing === "nuovo" ? null : editing}
              onDone={() => setEditing(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={conferma.open}
        onOpenChange={conferma.onOpenChange}
        title={`Eliminare ${conferma.target?.nome ?? "il contatto"}?`}
        onConfirm={async () => {
          if (!conferma.target) return;
          const result = await deleteContatto(clienteId, conferma.target.id);
          if (!result.ok) {
            toast.error(result.error);
            return false;
          }
          toast.success("Contatto eliminato");
          aggiornaScheda();
        }}
      />
    </Card>
  );
}

function ContattoForm({
  clienteId,
  contatto,
  onDone,
}: {
  clienteId: string;
  contatto: Contatto | null;
  onDone: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const aggiornaScheda = useAggiornaScheda();
  const { register, control, handleSubmit, setError, formState } = useForm<ContattoFormValues>({
    resolver: zodResolver(contattoSchema),
    defaultValues: {
      nome: contatto?.nome ?? "",
      ruolo: contatto?.ruolo ?? "",
      email: contatto?.email ?? "",
      telefono: contatto?.telefono ?? "",
      principale: contatto?.principale ?? false,
    },
  });
  const err = formState.errors;

  const onSubmit = handleSubmit((values) =>
    startTransition(async () => {
      const result = await saveContatto(clienteId, values, contatto?.id);
      if (!result.ok) {
        for (const [field, message] of Object.entries(result.fieldErrors ?? {})) {
          setError(field as FieldPath<ContattoFormValues>, { message });
        }
        toast.error(result.error);
        return;
      }
      toast.success(contatto ? "Contatto aggiornato" : "Contatto aggiunto");
      aggiornaScheda();
      onDone();
    }),
  );

  return (
    <form onSubmit={onSubmit} noValidate>
      <FieldGroup className="gap-4">
        <Field data-invalid={Boolean(err.nome) || undefined}>
          <FieldLabel htmlFor="contatto-nome">Nome</FieldLabel>
          <Input id="contatto-nome" {...register("nome")} autoFocus aria-invalid={Boolean(err.nome) || undefined} />
          <FieldError errors={[err.nome]} />
        </Field>
        <Field>
          <FieldLabel htmlFor="contatto-ruolo">Ruolo</FieldLabel>
          <Input id="contatto-ruolo" {...register("ruolo")} placeholder="es. Marketing, Titolare" />
        </Field>
        <Field data-invalid={Boolean(err.email) || undefined}>
          <FieldLabel htmlFor="contatto-email">Email</FieldLabel>
          <Input id="contatto-email" type="email" {...register("email")} aria-invalid={Boolean(err.email) || undefined} />
          <FieldError errors={[err.email]} />
        </Field>
        <Field>
          <FieldLabel htmlFor="contatto-telefono">Telefono</FieldLabel>
          <Input id="contatto-telefono" type="tel" {...register("telefono")} />
        </Field>
        {!contatto?.principale && (
          <Field orientation="horizontal">
            <Controller
              control={control}
              name="principale"
              render={({ field }) => (
                <Checkbox
                  id="contatto-principale"
                  aria-label="Contatto principale"
                  checked={field.value}
                  onCheckedChange={(checked) => field.onChange(checked === true)}
                />
              )}
            />
            <FieldLabel htmlFor="contatto-principale" className="font-normal">
              Contatto principale (riceve gli avvisi di scadenza)
            </FieldLabel>
          </Field>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onDone} disabled={pending}>
            Annulla
          </Button>
          <Button type="submit" disabled={pending}>
            {contatto ? "Salva" : "Aggiungi"}
          </Button>
        </div>
      </FieldGroup>
    </form>
  );
}
