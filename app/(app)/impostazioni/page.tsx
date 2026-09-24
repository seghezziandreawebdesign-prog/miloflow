import type { Metadata } from "next";

import { CassaforteSettings } from "@/components/impostazioni/cassaforte-settings";
import { NotificheSettings } from "@/components/impostazioni/notifiche-settings";
import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";
import { getUtenteCorrente } from "@/lib/utente.server";

export const metadata: Metadata = { title: "Impostazioni" };

export default async function ImpostazioniPage() {
  const utente = await getUtenteCorrente();
  const isOwner = utente.ruolo === "owner";
  const supabase = await createClient();
  const { data: notifiche } = isOwner
    ? await supabase.from("impostazioni_notifiche").select("email, orario, giorni_anticipo, attivo, ultimo_invio").maybeSingle()
    : { data: null };

  return (
    <>
      <PageHeader
        title="Impostazioni"
        description="Categorie, tipi di servizio e utenti arrivano con le prossime fasi."
      />
      <div className="max-w-3xl space-y-6">
        <CassaforteSettings isOwner={isOwner} />
        {isOwner && notifiche && <NotificheSettings iniziali={notifiche} emailUtente={utente.email} />}
      </div>
    </>
  );
}
