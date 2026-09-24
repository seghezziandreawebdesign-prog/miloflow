import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";

import { createClient } from "@/lib/supabase/server";

export type UtenteCorrente = {
  id: string;
  email: string;
  nome: string;
  ruolo: "owner" | "collaboratore";
  /** Numero di sezioni su cui ha un permesso (per l'owner non conta). */
  permessi: number;
};

// Una sola lettura per richiesta, condivisa da layout e pagine.
export const getUtenteCorrente = cache(async (): Promise<UtenteCorrente> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profilo }, { count: permessi }] = await Promise.all([
    supabase.from("profili").select("nome, ruolo").eq("id", user.id).single(),
    supabase.from("permessi").select("sezione", { count: "exact", head: true }).eq("user_id", user.id),
  ]);

  return {
    id: user.id,
    email: user.email ?? "",
    nome: profilo?.nome ?? user.email ?? "",
    ruolo: profilo?.ruolo ?? "collaboratore",
    permessi: permessi ?? 0,
  };
});
