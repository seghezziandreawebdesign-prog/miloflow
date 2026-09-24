"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

import { APRI_PARAM, formatApri, type RiferimentoEntita } from "@/lib/entita";

/** Apre un'entità nel pannello laterale aggiungendo ?apri= all'URL corrente. */
export function useApriEntita() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return useCallback(
    (ref: RiferimentoEntita) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set(APRI_PARAM, formatApri(ref));
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [router, pathname, searchParams],
  );
}
