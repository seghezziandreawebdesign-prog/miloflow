"use client";

import { CalendarDays, RefreshCw } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { CopyButton } from "@/components/copy-button";
import { Segmented } from "@/components/segmented";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { rigeneraTokenIcs, saveImpostazioniCalendario } from "@/lib/actions/impostazioni";
import { TIPI_CALENDARIO, VISTE_CALENDARIO, type TipoCalendario, type VistaCalendario } from "@/lib/calendario";
import type { ImpostazioniCalendarioRiga } from "@/lib/queries/calendario";

const INTERVALLI = [
  { value: "15", label: "15 min" },
  { value: "30", label: "30 min" },
  { value: "60", label: "1 ora" },
] as const;

const AMBITI_ICS = [
  { value: "tutto", label: "Tutto" },
  { value: "lavoro", label: "Lavoro" },
  { value: "personale", label: "Personale" },
] as const;

export function CalendarioSettings({ iniziali, urlFunzioni }: { iniziali: ImpostazioniCalendarioRiga; urlFunzioni: string }) {
  const [intervallo, setIntervallo] = useState(String(iniziali.intervallo_minuti) as (typeof INTERVALLI)[number]["value"]);
  const [oraInizio, setOraInizio] = useState(iniziali.ora_inizio);
  const [oraFine, setOraFine] = useState(iniziali.ora_fine);
  const [vista, setVista] = useState<VistaCalendario>(iniziali.vista_default);
  const [include, setInclude] = useState<Set<string>>(new Set(iniziali.ics_include));
  const [ambitoIcs, setAmbitoIcs] = useState<(typeof AMBITI_ICS)[number]["value"]>(iniziali.ics_ambito ?? "tutto");
  const [token, setToken] = useState(iniziali.token_ics);
  const [errori, setErrori] = useState<Record<string, string>>({});
  const [saving, startSaving] = useTransition();
  const [generating, startGenerating] = useTransition();
  const urlIcs = token ? `${urlFunzioni}/calendario-ics?token=${token}` : null;

  function salva(e: React.FormEvent) {
    e.preventDefault();
    startSaving(async () => {
      const result = await saveImpostazioniCalendario({
        intervallo_minuti: intervallo,
        ora_inizio: oraInizio,
        ora_fine: oraFine,
        vista_default: vista,
        ics_include: [...include],
        ics_ambito: ambitoIcs,
      });
      setErrori(result.ok ? {} : (result.fieldErrors ?? {}));
      if (!result.ok) toast.error(result.error);
      else toast.success("Impostazioni del calendario salvate");
    });
  }

  function rigenera() {
    startGenerating(async () => {
      const result = await rigeneraTokenIcs();
      if (!result.ok) toast.error(result.error);
      else {
        setToken(result.data.token);
        toast.success(token ? "Nuovo link generato: il vecchio non funziona più" : "Link del calendario creato");
      }
    });
  }

  return (
    <Card id="calendario">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarDays className="size-4" />
          Calendario
        </CardTitle>
        <CardDescription>Tacche delle viste giorno e settimana, orari mostrati e il feed da aggiungere a Google Calendar o Apple Calendar.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={salva} noValidate className="max-w-xl space-y-6">
          <FieldGroup className="gap-4">
            <Segmented label="Tacche" value={intervallo} onChange={setIntervallo} opzioni={INTERVALLI} />
            <div className="grid grid-cols-2 gap-4">
              <Field data-invalid={Boolean(errori.ora_inizio) || undefined}>
                <FieldLabel htmlFor="cal-ora-inizio">Giornata dalle</FieldLabel>
                <Input id="cal-ora-inizio" type="time" step={1800} value={oraInizio} onChange={(e) => setOraInizio(e.target.value)} />
                <FieldError>{errori.ora_inizio}</FieldError>
              </Field>
              <Field data-invalid={Boolean(errori.ora_fine) || undefined}>
                <FieldLabel htmlFor="cal-ora-fine">alle</FieldLabel>
                <Input id="cal-ora-fine" type="time" step={1800} value={oraFine} onChange={(e) => setOraFine(e.target.value)} />
                <FieldError>{errori.ora_fine}</FieldError>
              </Field>
            </div>
            <Segmented label="Vista di partenza" value={vista} onChange={setVista} opzioni={VISTE_CALENDARIO} />
          </FieldGroup>

          <div className="space-y-3 border-t pt-5">
            <div>
              <p className="text-sm font-medium">Feed ICS</p>
              <p className="text-xs text-muted-foreground">
                Un link segreto da incollare in «Aggiungi calendario da URL». Chi ha il link vede il calendario: se lo perdi di vista, rigeneralo.
              </p>
            </div>
            {urlIcs ? (
              <div className="flex items-center gap-2 rounded-lg bg-muted/60 px-3 py-2 font-mono text-xs">
                <span className="min-w-0 flex-1 truncate">{urlIcs}</span>
                <CopyButton value={urlIcs} label="Link del calendario" />
              </div>
            ) : (
              <FieldDescription>Nessun link ancora: crealo con il pulsante qui sotto.</FieldDescription>
            )}
            <Button type="button" variant="outline" size="sm" disabled={generating} onClick={rigenera}>
              <RefreshCw className={generating ? "animate-spin" : undefined} />
              {token ? "Rigenera il link" : "Crea il link"}
            </Button>
            <div className="grid gap-2 sm:grid-cols-2">
              {/* I calendari esterni non escono nel feed: sono già altrove. */}
              {TIPI_CALENDARIO.filter((t) => t.value !== "esterno").map((t) => {
                const id = `ics-${t.value}`;
                return (
                  <Field key={t.value} orientation="horizontal">
                    <Checkbox
                      id={id}
                      checked={include.has(t.value)}
                      onCheckedChange={(v) => {
                        const next = new Set(include);
                        if (v === true) next.add(t.value as TipoCalendario);
                        else next.delete(t.value);
                        setInclude(next);
                      }}
                    />
                    <FieldLabel htmlFor={id} className="font-normal">
                      {t.label}
                    </FieldLabel>
                  </Field>
                );
              })}
            </div>
            <Segmented label="Ambito nel feed" value={ambitoIcs} onChange={setAmbitoIcs} opzioni={AMBITI_ICS} />
          </div>

          <Button type="submit" disabled={saving}>
            {saving ? "Salvataggio…" : "Salva"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
