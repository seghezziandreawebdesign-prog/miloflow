import type { Metadata } from "next";

import { CalendarioSettings } from "@/components/impostazioni/calendario-settings";
import { CassaforteSettings } from "@/components/impostazioni/cassaforte-settings";
import { MetodiPagamentoSettings } from "@/components/impostazioni/metodi-pagamento-settings";
import { NotificheSettings } from "@/components/impostazioni/notifiche-settings";
import { PageHeader } from "@/components/page-header";
import { leggiImpostazioniCalendario } from "@/lib/queries/calendario";
import { createClient } from "@/lib/supabase/server";
import { supabaseUrl } from "@/lib/supabase/env";
import { getUtenteCorrente } from "@/lib/utente.server";

export const metadata: Metadata = { title: "Impostazioni" };

export default async function ImpostazioniPage() {
  const utente = await getUtenteCorrente();
  const isOwner = utente.ruolo === "owner";
  const supabase = await createClient();
  const [{ data: notifiche }, { data: metodi }, budget, calendario] = await Promise.all([
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
  ]);

  return (
    <>
      <PageHeader
        title="Impostazioni"
        description="Calendario, cassaforte, metodi di pagamento e notifiche. Categorie, tipi di servizio e utenti arrivano con le prossime fasi."
      />
      <div className="max-w-3xl space-y-6">
        <CalendarioSettings iniziali={calendario} urlFunzioni={`${supabaseUrl}/functions/v1`} />
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
      </div>
    </>
  );
}
