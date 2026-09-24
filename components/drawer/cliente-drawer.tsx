"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Mail, Phone } from "lucide-react";
import Link from "next/link";

import { ClienteLogo } from "@/components/clienti/cliente-logo";
import { StatoClienteBadge } from "@/components/clienti/stato-badge";
import { CopyButton } from "@/components/copy-button";
import { buttonVariants } from "@/components/ui/button";
import { PannelloDescription, PannelloHeader, PannelloTitle } from "@/components/drawer/pannello";
import { Skeleton } from "@/components/ui/skeleton";
import { nomeCliente } from "@/lib/clienti";
import { createClient } from "@/lib/supabase/client";

async function fetchCliente(id: string) {
  const supabase = createClient();
  const [cliente, contatto] = await Promise.all([
    supabase.from("clienti").select("*").eq("id", id).maybeSingle(),
    supabase.from("clienti_contatti").select("*").eq("cliente_id", id).eq("principale", true).maybeSingle(),
  ]);
  if (cliente.error) throw cliente.error;
  if (!cliente.data) return null;
  let logoUrl: string | null = null;
  if (cliente.data.logo_path) {
    const { data } = await supabase.storage.from("loghi").createSignedUrl(cliente.data.logo_path, 3600);
    logoUrl = data?.signedUrl ?? null;
  }
  return { cliente: cliente.data, contatto: contatto.data, logoUrl };
}

/** Anteprima del cliente nel pannello laterale; la scheda completa è una pagina. */
export function ClienteDrawer({ id }: { id: string }) {
  const { data, isPending, isError } = useQuery({ queryKey: ["cliente", id], queryFn: () => fetchCliente(id) });

  if (isPending) {
    return (
      <div className="space-y-3 p-4">
        <Skeleton className="size-16 rounded-xl" />
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    );
  }
  if (isError || !data) {
    return (
      <PannelloHeader>
        <PannelloTitle>Cliente non trovato</PannelloTitle>
        <PannelloDescription>Potrebbe essere stato eliminato, oppure non hai accesso.</PannelloDescription>
      </PannelloHeader>
    );
  }

  const { cliente: c, contatto, logoUrl } = data;
  const nome = nomeCliente(c);

  return (
    <div className="flex flex-col">
      <PannelloHeader className="gap-3 pr-12 sm:pr-14">
        <ClienteLogo nome={nome} colore={c.colore} logoUrl={logoUrl} sito={c.sito} size="lg" />
        <div>
          <PannelloTitle className="text-lg">{nome}</PannelloTitle>
          <PannelloDescription>{c.nome_breve ? c.ragione_sociale : c.citta}</PannelloDescription>
        </div>
        <StatoClienteBadge stato={c.stato} className="w-fit" />
      </PannelloHeader>

      <dl className="space-y-3 px-4 text-sm">
        {c.piva && <Riga label="Partita IVA" value={`${c.nazione} ${c.piva}`} copia={c.piva} />}
        {c.codice_fiscale && <Riga label="Codice fiscale" value={c.codice_fiscale} copia={c.codice_fiscale} />}
        {c.codice_sdi && <Riga label="Codice SDI" value={c.codice_sdi} copia={c.codice_sdi} />}
        {c.pec && <Riga label="PEC" value={c.pec} copia={c.pec} />}
      </dl>

      {contatto && (
        <div className="mx-4 mt-5 rounded-lg bg-muted/60 p-3 text-sm">
          <p className="text-xs text-muted-foreground">Contatto principale</p>
          <p className="font-medium">{contatto.nome}</p>
          {contatto.email && (
            <a href={`mailto:${contatto.email}`} className="flex items-center gap-1.5 hover:underline">
              <Mail className="size-3.5" />
              {contatto.email}
            </a>
          )}
          {contatto.telefono && (
            <a href={`tel:${contatto.telefono.replace(/\s/g, "")}`} className="flex items-center gap-1.5 hover:underline">
              <Phone className="size-3.5" />
              {contatto.telefono}
            </a>
          )}
        </div>
      )}

      <div className="mt-auto p-4">
        <Link href={`/clienti/${c.id}`} className={buttonVariants({ className: "w-full" })}>
          Apri scheda
          <ArrowRight />
        </Link>
      </div>
    </div>
  );
}

function Riga({ label, value, copia }: { label: string; value: string; copia: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="flex items-center gap-1">
        <span className="truncate">{value}</span>
        <CopyButton value={copia} label={label} />
      </dd>
    </div>
  );
}
