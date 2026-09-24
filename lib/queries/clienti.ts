import "server-only";

import { notFound } from "next/navigation";

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
  const [cliente, contatti, link, diario] = await Promise.all([
    supabase.from("clienti").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("clienti_contatti")
      .select("*")
      .eq("cliente_id", id)
      .order("principale", { ascending: false })
      .order("nome"),
    supabase.from("clienti_link").select("*").eq("cliente_id", id).order("ordine").order("created_at"),
    supabase
      .from("clienti_diario")
      .select("*")
      .eq("cliente_id", id)
      .order("data", { ascending: false })
      .order("created_at", { ascending: false }),
  ]);
  if (cliente.error) throw new Error(`Lettura cliente non riuscita: ${cliente.error.message}`);
  if (!cliente.data) notFound();

  const urls = await signedLogoUrls(supabase, cliente.data.logo_path ? [cliente.data.logo_path] : []);
  return {
    cliente: {
      ...cliente.data,
      logo_url: cliente.data.logo_path ? (urls.get(cliente.data.logo_path) ?? null) : null,
    },
    contatti: contatti.data ?? [],
    link: link.data ?? [],
    diario: diario.data ?? [],
  };
}

export type SchedaCliente = Awaited<ReturnType<typeof getCliente>>;
