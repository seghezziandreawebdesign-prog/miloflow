import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";

import { createClient } from "@/lib/supabase/server";

export type UtenteCorrente = {
  id: string;
  email: string;
  nome: string;
  ruolo: "owner" | "collaboratore";
};

// Una sola lettura per richiesta, condivisa da layout e pagine.
export const getUtenteCorrente = cache(async (): Promise<UtenteCorrente> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profilo } = await supabase
    .from("profili")
    .select("nome, ruolo")
    .eq("id", user.id)
    .single();

  return {
    id: user.id,
    email: user.email ?? "",
    nome: profilo?.nome ?? user.email ?? "",
    ruolo: profilo?.ruolo ?? "collaboratore",
  };
});
