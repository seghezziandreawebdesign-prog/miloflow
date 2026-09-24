"use client";

import { ExternalLink } from "lucide-react";

import { CopyButton } from "@/components/copy-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PAESI } from "@/lib/clienti";
import type { SchedaCliente } from "@/lib/queries/clienti";

import { ContattiCliente } from "./contatti-cliente";
import { LinkCliente } from "./link-cliente";

export function PanoramicaCliente({ scheda }: { scheda: SchedaCliente }) {
  const c = scheda.cliente;
  const paese = PAESI.find((p) => p.value === c.nazione)?.label ?? c.nazione;
  const luogo = [c.cap, c.citta, c.provincia && `(${c.provincia})`].filter(Boolean).join(" ");

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Dati</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
              <Dato label="Tipo" value={c.tipo === "azienda" ? "Azienda" : "Privato"} />
              <Dato label="Partita IVA" value={c.piva && `${c.nazione} ${c.piva}`} copia={c.piva} />
              <Dato label="Codice fiscale" value={c.codice_fiscale} copia={c.codice_fiscale} />
              <Dato label="Codice SDI" value={c.codice_sdi} copia={c.codice_sdi} />
              <Dato label="PEC" value={c.pec} copia={c.pec} href={c.pec ? `mailto:${c.pec}` : undefined} />
              <Dato label="Email" value={c.email} copia={c.email} href={c.email ? `mailto:${c.email}` : undefined} />
              <Dato label="Telefono" value={c.telefono} href={c.telefono ? `tel:${c.telefono.replace(/\s/g, "")}` : undefined} />
              <Dato label="Sito" value={c.sito?.replace(/^https?:\/\//, "")} href={c.sito ?? undefined} esterno />
              <Dato
                label="Indirizzo"
                value={[c.indirizzo, luogo, c.nazione !== "IT" ? paese : null].filter(Boolean).join(", ") || null}
                className="sm:col-span-2"
              />
            </dl>
          </CardContent>
        </Card>

        {c.note && (
          <Card>
            <CardHeader>
              <CardTitle>Note</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-wrap">{c.note}</p>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="space-y-4">
        <ContattiCliente clienteId={c.id} contatti={scheda.contatti} />
        <LinkCliente clienteId={c.id} link={scheda.link} />
      </div>
    </div>
  );
}

function Dato({
  label,
  value,
  copia,
  href,
  esterno,
  className,
}: {
  label: string;
  value: string | null | undefined;
  copia?: string | null;
  href?: string;
  esterno?: boolean;
  className?: string;
}) {
  return (
    <div className={className}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="flex min-h-6 items-center gap-1 text-sm">
        {value ? (
          <>
            {href ? (
              <a
                href={href}
                className="truncate underline-offset-4 hover:underline"
                {...(esterno ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              >
                {value}
                {esterno && <ExternalLink className="ml-1 inline size-3" />}
              </a>
            ) : (
              <span className="truncate">{value}</span>
            )}
            {copia && <CopyButton value={copia} label={label} />}
          </>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </dd>
    </div>
  );
}
