import "server-only";

import { cookies } from "next/headers";

import { AMBITO_COOKIE, parseFiltroAmbito, type FiltroAmbito } from "./ambito";

export async function getFiltroAmbito(): Promise<FiltroAmbito> {
  const cookieStore = await cookies();
  return parseFiltroAmbito(cookieStore.get(AMBITO_COOKIE)?.value);
}
