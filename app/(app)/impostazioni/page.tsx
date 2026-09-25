import type { Metadata } from "next";

import { BackupSettings } from "@/components/impostazioni/backup-settings";
import { CalendariEsterniSettings } from "@/components/impostazioni/calendari-esterni-settings";
import { CalendarioSettings } from "@/components/impostazioni/calendario-settings";
import { CassaforteSettings } from "@/components/impostazioni/cassaforte-settings";
import { CategorieSettings } from "@/components/impostazioni/categorie-settings";
import { MetodiPagamentoSettings } from "@/components/impostazioni/metodi-pagamento-settings";
import { NotificheSettings } from "@/components/impostazioni/notifiche-settings";
import { PageHeader } from "@/components/page-header";
import { leggiCategorie } from "@/lib/queries/budget";
import { leggiCalendariEsterni, leggiImpostazioniCalendario } from "@/lib/queries/calendario";
import { createClient } from "@/lib/supabase/server";
import { supabaseUrl } from "@/lib/supabase/env";
import { getUtenteCorrente } from "@/lib/utente.server";

export const metadata: Metadata = { title: "Impostazioni" };

export default async function ImpostazioniPage() {
  const utente = await getUtenteCorrente();
  const isOwner = utente.ruolo === "owner";
  const supabase = await createClient();
  const [{ data: notifiche }, { data: metodi }, budget, calendario, calendariEsterni, categorie, clienti, servizi, task] = await Promise.all([
    isOwner
      ? supabase.from("impostazioni_notifiche").select("email, orario, giorni_anticipo, attivo, ultimo_invio").maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("metodi_pagamento")
      .select("id, nome, tipo, ultime_cifre, ambito, colore, archiviato, servizi_economico(count)")
      .order("ordine")
      .order("nome"),
    supabase.rpc("puo", { p_sezione: "budget", p_livello: "scrittura" }),
    leggiImpostazioniCalendario(),
    leggiCalendariEsterni(),
    leggiCategorie(),
    supabase.from("clienti").select("id", { count: "exact", head: true }),
    supabase.from("servizi").select("id", { count: "exact", head: true }),
    supabase.from("task").select("id", { count: "exact", head: true }),
  ]);
  const vuoto = (clienti.count ?? 0) + (servizi.count ?? 0) + (task.count ?? 0) === 0;

  return (
    <>
      <PageHeader
        title="Impostazioni"
        description="Calendario, categorie di spesa, cassaforte, metodi di pagamento, notifiche e backup. Tipi di servizio e utenti arrivano con la fase 6."
      />
      <div className="max-w-3xl space-y-6">
        <CalendarioSettings iniziali={calendario} urlFunzioni={`${supabaseUrl}/functions/v1`} />
        <CalendariEsterniSettings calendari={calendariEsterni} />
        {budget.data === true && <CategorieSettings categorie={categorie} />}
        <CassaforteSettings isOwner={isOwner} />
        {budget.data === true && (
          <MetodiPagamentoSettings
            metodi={(metodi ?? []).map(({ servizi_economico, ...m }) => ({
              ...m,
              servizi: servizi_economico[0]?.count ?? 0,
            }))}
          />
        )}
        {isOwner && notifiche && <NotificheSettings iniziali={notifiche} emailUtente={utente.email} />}
        {isOwner && <BackupSettings vuoto={vuoto} />}
      </div>
    </>
  );
}
