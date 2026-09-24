"use client";

import { Loader2, Mail, Send } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { inviaProvaDigest, saveImpostazioniNotifiche } from "@/lib/actions/impostazioni";
import { formatDate } from "@/lib/dates/format";

type Impostazioni = {
  email: string | null;
  orario: string;
  giorni_anticipo: number;
  attivo: boolean;
  ultimo_invio: string | null;
};

export function NotificheSettings({ iniziali, emailUtente }: { iniziali: Impostazioni; emailUtente: string }) {
  const [email, setEmail] = useState(iniziali.email ?? emailUtente);
  const [orario, setOrario] = useState(iniziali.orario.slice(0, 5));
  const [giorni, setGiorni] = useState(String(iniziali.giorni_anticipo));
  const [attivo, setAttivo] = useState(iniziali.attivo);
  const [errori, setErrori] = useState<Record<string, string>>({});
  const [saving, startSaving] = useTransition();
  const [testing, startTesting] = useTransition();

  function salva(e: React.FormEvent) {
    e.preventDefault();
    startSaving(async () => {
      const result = await saveImpostazioniNotifiche({ email, orario, giorni_anticipo: giorni, attivo });
      setErrori(result.ok ? {} : (result.fieldErrors ?? {}));
      if (!result.ok) toast.error(result.error);
      else toast.success(attivo ? `Riepilogo attivo: arriva ogni mattina alle ${orario}` : "Impostazioni salvate");
    });
  }

  function prova() {
    startTesting(async () => {
      const result = await inviaProvaDigest();
      if (!result.ok) toast.error(result.error);
      else toast.success((result.data as { messaggio: string }).messaggio);
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="size-4" />
          Riepilogo del mattino
        </CardTitle>
        <CardDescription>
          Un&apos;email con servizi scaduti o in scadenza entro il preavviso, task in ritardo e rate in arrivo. Se non c&apos;è
          niente da segnalare, non parte.
          {iniziali.ultimo_invio && ` Ultimo invio: ${formatDate(iniziali.ultimo_invio)}.`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={salva} noValidate className="max-w-md">
          <FieldGroup className="gap-4">
            <Field orientation="horizontal">
              <Checkbox id="notifiche-attivo" aria-label="Riepilogo attivo" checked={attivo} onCheckedChange={(v) => setAttivo(v === true)} />
              <FieldLabel htmlFor="notifiche-attivo" className="font-normal">
                Invia il riepilogo ogni mattina
              </FieldLabel>
            </Field>
            <Field data-invalid={Boolean(errori.email) || undefined}>
              <FieldLabel htmlFor="notifiche-email">Email</FieldLabel>
              <Input id="notifiche-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              <FieldError>{errori.email}</FieldError>
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field data-invalid={Boolean(errori.orario) || undefined}>
                <FieldLabel htmlFor="notifiche-orario">Orario</FieldLabel>
                <Input id="notifiche-orario" type="time" step={900} value={orario} onChange={(e) => setOrario(e.target.value)} />
                <FieldError>{errori.orario}</FieldError>
              </Field>
              <Field data-invalid={Boolean(errori.giorni_anticipo) || undefined}>
                <FieldLabel htmlFor="notifiche-giorni">Rate: giorni di anticipo</FieldLabel>
                <Input id="notifiche-giorni" inputMode="numeric" value={giorni} onChange={(e) => setGiorni(e.target.value)} />
                <FieldError>{errori.giorni_anticipo}</FieldError>
              </Field>
            </div>
            <FieldDescription>
              Orario di Roma, con una precisione di 15 minuti. Per i servizi vale il preavviso di ciascuno.
            </FieldDescription>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="animate-spin" />}
                Salva
              </Button>
              <Button type="button" variant="outline" onClick={prova} disabled={testing}>
                {testing ? <Loader2 className="animate-spin" /> : <Send />}
                Invia una prova
              </Button>
            </div>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}
