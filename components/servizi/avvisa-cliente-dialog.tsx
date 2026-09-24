"use client";

import { useQuery } from "@tanstack/react-query";
import { Loader2, Send } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatDate } from "@/lib/dates/format";
import { createClient } from "@/lib/supabase/client";

function testoPredefinito(nomeContatto: string, servizio: string, scadenza: string) {
  return `Buongiorno ${nomeContatto},

le scrivo per ricordarle che il servizio "${servizio}" scade il ${formatDate(scadenza)}.

Se desidera rinnovarlo, mi faccia sapere e mi occupo io di tutto.

Un saluto`;
}

export function AvvisaClienteDialog({
  open,
  onOpenChange,
  servizio,
  clienti,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  servizio: { id: string; nome: string; prossima_scadenza: string };
  clienti: { id: string; nome: string }[];
}) {
  const [clienteId, setClienteId] = useState(clienti[0]?.id ?? "");
  const [bozza, setBozza] = useState<{ clienteId: string; oggetto: string; testo: string } | null>(null);
  const [conferma, setConferma] = useState(false);

  const { data: contatto, isPending } = useQuery({
    queryKey: ["contatto-principale", clienteId],
    enabled: open && Boolean(clienteId),
    queryFn: async () => {
      const { data } = await createClient()
        .from("clienti_contatti")
        .select("nome, email")
        .eq("cliente_id", clienteId)
        .eq("principale", true)
        .maybeSingle();
      return data;
    },
  });

  // La bozza si inizializza una volta per cliente; poi resta quella modificata.
  const oggetto = bozza?.clienteId === clienteId ? bozza.oggetto : `Scadenza ${servizio.nome}`;
  const testo =
    bozza?.clienteId === clienteId
      ? bozza.testo
      : testoPredefinito(contatto?.nome ?? "", servizio.nome, servizio.prossima_scadenza);

  async function invia() {
    const { data, error } = await createClient().functions.invoke("invia-email-cliente", {
      body: { servizio_id: servizio.id, cliente_id: clienteId, oggetto, testo },
    });
    if (error) {
      let messaggio = "Invio non riuscito";
      try {
        const body = await (error as { context?: Response }).context?.json();
        if (body?.errore) messaggio = body.errore;
      } catch {
        // risposta non leggibile
      }
      toast.error(messaggio);
      return false;
    }
    toast.success(`Email inviata a ${data.a}. L'invio è stato annotato nel diario del cliente.`);
    setBozza(null);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Avvisa il cliente</DialogTitle>
          <DialogDescription>Controlla e modifica il testo: parte solo quando confermi l&apos;invio.</DialogDescription>
        </DialogHeader>
        <FieldGroup className="gap-4">
          {clienti.length > 1 && (
            <Field>
              <FieldLabel>Cliente</FieldLabel>
              <Select
                items={clienti.map((c) => ({ value: c.id, label: c.nome }))}
                value={clienteId}
                onValueChange={(v) => v && setClienteId(v)}
              >
                <SelectTrigger className="w-full" aria-label="Cliente">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {clienti.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}

          <div className="rounded-md bg-muted/60 px-3 py-2 text-sm">
            {isPending ? (
              "Cerco il contatto principale…"
            ) : contatto?.email ? (
              <>
                A: <strong>{contatto.nome}</strong> &lt;{contatto.email}&gt;
              </>
            ) : (
              <span className="text-amber-800">
                Questo cliente non ha un contatto principale con email: aggiungilo dalla scheda cliente.
              </span>
            )}
          </div>

          <Field>
            <FieldLabel htmlFor="avviso-oggetto">Oggetto</FieldLabel>
            <Input
              id="avviso-oggetto"
              value={oggetto}
              onChange={(e) => setBozza({ clienteId, oggetto: e.target.value, testo })}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="avviso-testo">Messaggio</FieldLabel>
            <Textarea
              id="avviso-testo"
              rows={9}
              value={testo}
              onChange={(e) => setBozza({ clienteId, oggetto, testo: e.target.value })}
            />
          </Field>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Annulla
            </Button>
            <Button disabled={!contatto?.email || !oggetto.trim() || !testo.trim()} onClick={() => setConferma(true)}>
              {isPending ? <Loader2 className="animate-spin" /> : <Send />}
              Invia…
            </Button>
          </div>
        </FieldGroup>

        <ConfirmDialog
          open={conferma}
          onOpenChange={setConferma}
          title="Inviare l'email?"
          description={contatto?.email ? `Il messaggio parte subito verso ${contatto.email}.` : undefined}
          confirmLabel="Invia ora"
          onConfirm={invia}
        />
      </DialogContent>
    </Dialog>
  );
}
