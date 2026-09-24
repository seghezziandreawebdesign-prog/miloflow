"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { AMBITO_COOKIE, FILTRI_AMBITO } from "@/lib/ambito";

const schema = z.enum(FILTRI_AMBITO);

export async function setFiltroAmbito(value: string) {
  const filtro = schema.parse(value);
  const cookieStore = await cookies();
  cookieStore.set(AMBITO_COOKIE, filtro, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  });
  // Tutte le pagine leggono il filtro lato server: vanno rigenerate.
  revalidatePath("/", "layout");
}
