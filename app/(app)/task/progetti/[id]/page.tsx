import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { ProgettoPagina } from "@/components/task/progetto-pagina";
import { createClient } from "@/lib/supabase/server";

async function getProgetto(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const { data } = await supabase.from("progetti").select("id, nome").eq("id", id).maybeSingle();
  if (!data) notFound();
  return data;
}

export async function generateMetadata(props: PageProps<"/task/progetti/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  const progetto = await getProgetto(id);
  return { title: progetto.nome };
}

export default async function Page(props: PageProps<"/task/progetti/[id]">) {
  const { id } = await props.params;
  await getProgetto(id);
  return (
    <Suspense>
      <ProgettoPagina id={id} />
    </Suspense>
  );
}
