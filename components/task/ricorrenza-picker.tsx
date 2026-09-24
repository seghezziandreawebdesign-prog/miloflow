"use client";

import { Repeat } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  descriviRicorrenza,
  fromRRule,
  GIORNI_BREVI,
  presetRicorrenza,
  toRRule,
  type FrequenzaRicorrenza,
  type Ricorrenza,
} from "@/lib/dates/ricorrenza";
import { todayISO } from "@/lib/dates/format";
import { cn } from "@/lib/utils";

const FREQUENZE: { value: FrequenzaRicorrenza; label: string }[] = [
  { value: "giornaliera", label: "giorni" },
  { value: "settimanale", label: "settimane" },
  { value: "mensile", label: "mesi" },
  { value: "annuale", label: "anni" },
];

/**
 * Scelta della ricorrenza: preset calcolati sulla data della task oppure una
 * regola personalizzata. Il valore è una stringa RRULE ("" = non si ripete).
 */
export function RicorrenzaPicker({
  value,
  onChange,
  dataRiferimento,
  id,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  /** Data della task (pianificata o scadenza), per i preset. */
  dataRiferimento?: string;
  id?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [personalizzata, setPersonalizzata] = useState<Ricorrenza | null>(null);
  const riferimento = dataRiferimento || todayISO();
  const preset = presetRicorrenza(riferimento);
  const descrizione = descriviRicorrenza(value);

  function scegli(nuovo: string) {
    onChange(nuovo);
    setOpen(false);
    setPersonalizzata(null);
  }

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setPersonalizzata(null);
      }}
    >
      <PopoverTrigger
        render={
          <Button
            id={id}
            type="button"
            variant="outline"
            className={cn("justify-start font-normal", !descrizione && "text-muted-foreground", className)}
          />
        }
      >
        <Repeat />
        <span className="truncate">{descrizione ?? "Non si ripete"}</span>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-1" align="start">
        {personalizzata ? (
          <Personalizzata valore={personalizzata} onChange={setPersonalizzata} onConferma={() => scegli(toRRule(personalizzata))} />
        ) : (
          <div className="flex flex-col">
            <Voce attiva={!value} onClick={() => scegli("")}>
              Non si ripete
            </Voce>
            {preset.map((p) => (
              <Voce key={p.value} attiva={value === p.value} onClick={() => scegli(p.value)}>
                {p.label}
              </Voce>
            ))}
            <Voce
              attiva={Boolean(value) && !preset.some((p) => p.value === value)}
              onClick={() =>
                setPersonalizzata(fromRRule(value) ?? { frequenza: "settimanale", intervallo: 1, giorni: [] })
              }
            >
              Personalizzata…
            </Voce>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

function Voce({ attiva, onClick, children }: { attiva: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn("rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent", attiva && "font-medium text-primary")}
    >
      {children}
    </button>
  );
}

function Personalizzata({
  valore,
  onChange,
  onConferma,
}: {
  valore: Ricorrenza;
  onChange: (valore: Ricorrenza) => void;
  onConferma: () => void;
}) {
  return (
    <div className="space-y-3 p-2">
      <div className="flex items-center gap-2 text-sm">
        Ogni
        <Input
          type="number"
          min={1}
          max={365}
          value={valore.intervallo}
          onChange={(e) => onChange({ ...valore, intervallo: Math.max(1, Number(e.target.value) || 1) })}
          className="w-16"
          aria-label="Intervallo"
        />
        <Select
          items={FREQUENZE}
          value={valore.frequenza}
          onValueChange={(v) => v && onChange({ ...valore, frequenza: v as FrequenzaRicorrenza })}
        >
          <SelectTrigger className="flex-1" aria-label="Unità">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FREQUENZE.map((f) => (
              <SelectItem key={f.value} value={f.value}>
                {f.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {valore.frequenza === "settimanale" && (
        <div className="flex flex-wrap gap-1" role="group" aria-label="Giorni della settimana">
          {GIORNI_BREVI.map((g, i) => {
            const attivo = valore.giorni.includes(i);
            return (
              <button
                key={g}
                type="button"
                aria-pressed={attivo}
                onClick={() =>
                  onChange({ ...valore, giorni: attivo ? valore.giorni.filter((d) => d !== i) : [...valore.giorni, i] })
                }
                className={cn(
                  "h-7 w-9 rounded-md border text-xs",
                  attivo ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted",
                )}
              >
                {g}
              </button>
            );
          })}
        </div>
      )}
      <p className="text-xs text-muted-foreground">{descriviRicorrenza(toRRule(valore))}</p>
      <Button type="button" size="sm" className="w-full" onClick={onConferma}>
        Conferma
      </Button>
    </div>
  );
}
