import "server-only";

import { notFound } from "next/navigation";

import { caricaSchedaCliente } from "@/lib/queries/cliente-scheda";
import { createClient } from "@/lib/supabase/server";

const LOGO_TTL = 60 * 60; // 1 ora

type SupabaseServer = Awaited<ReturnType<typeof createClient>>;

async function signedLogoUrls(supabase: SupabaseServer, paths: string[]): Promise<Map<string, string>> {
  if (paths.length === 0) return new Map();
  const { data } = await supabase.storage.from("loghi").createSignedUrls(paths, LOGO_TTL);
  return new Map(
    (data ?? []).flatMap((d) => (d.path && d.signedUrl ? [[d.path, d.signedUrl] as const] : [])),
  );
}

export async function listClienti() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("v_clienti").select("*").order("ragione_sociale");
  if (error) throw new Error(`Lettura clienti non riuscita: ${error.message}`);

  const urls = await signedLogoUrls(
    supabase,
    data.flatMap((c) => (c.logo_path ? [c.logo_path] : [])),
  );
  return data.map((c) => ({ ...c, logo_url: c.logo_path ? (urls.get(c.logo_path) ?? null) : null }));
}

export type ClienteLista = Awaited<ReturnType<typeof listClienti>>[number];

export async function getCliente(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const scheda = await caricaSchedaCliente(supabase, id);
  if (!scheda) notFound();
  return scheda;
}

export type { SchedaCliente } from "@/lib/queries/cliente-scheda";
