"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

import {
  cifraCredenziale,
  decifraCredenziale,
  sbloccaCassaforte,
  type CredenzialeCifrata,
  type ParametriCassaforte,
} from "@/lib/crypto/vault";
import { createClient } from "@/lib/supabase/client";

// La chiave derivata vive solo in questa memoria: niente storage, niente server.
// Si cancella al logout (il provider si smonta) o dopo 15 minuti di inattività.
const INATTIVITA_MS = 15 * 60 * 1000;

type StatoCassaforte = "caricamento" | "non_configurata" | "bloccata" | "sbloccata";

type VaultContext = {
  stato: StatoCassaforte;
  parametri: ParametriCassaforte | null;
  sblocca: (password: string) => Promise<void>;
  blocca: () => void;
  cifra: (segreto: string) => Promise<CredenzialeCifrata>;
  decifra: (c: CredenzialeCifrata) => Promise<string>;
  /** Da chiamare dopo aver creato o cambiato la cassaforte. */
  ricarica: () => void;
};

const Context = createContext<VaultContext | null>(null);

export function useVault() {
  const ctx = useContext(Context);
  if (!ctx) throw new Error("useVault fuori da VaultProvider");
  return ctx;
}

async function leggiParametri(): Promise<ParametriCassaforte | null> {
  const supabase = createClient();
  const { data } = await supabase.from("cassaforte").select("salt, iterazioni, iv, verifica_cifrata").maybeSingle();
  return data;
}

export function VaultProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const { data: parametri, isPending } = useQuery({
    queryKey: ["cassaforte"],
    queryFn: leggiParametri,
    staleTime: Infinity,
  });
  const [chiave, setChiave] = useState<CryptoKey | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const blocca = useCallback(() => {
    setChiave(null);
    if (timer.current) clearTimeout(timer.current);
  }, []);

  // Timer di inattività, riavviato da ogni interazione mentre è sbloccata.
  useEffect(() => {
    if (!chiave) return;
    const riavvia = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(blocca, INATTIVITA_MS);
    };
    riavvia();
    const eventi = ["pointerdown", "keydown", "scroll"] as const;
    for (const e of eventi) window.addEventListener(e, riavvia, { passive: true });
    return () => {
      for (const e of eventi) window.removeEventListener(e, riavvia);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [chiave, blocca]);

  const sblocca = useCallback(
    async (password: string) => {
      if (!parametri) throw new Error("Cassaforte non configurata");
      setChiave(await sbloccaCassaforte(password, parametri));
    },
    [parametri],
  );

  const cifra = useCallback(
    async (segreto: string) => {
      if (!chiave) throw new Error("Cassaforte bloccata");
      return cifraCredenziale(chiave, segreto);
    },
    [chiave],
  );

  const decifra = useCallback(
    async (c: CredenzialeCifrata) => {
      if (!chiave) throw new Error("Cassaforte bloccata");
      return decifraCredenziale(chiave, c);
    },
    [chiave],
  );

  const ricarica = useCallback(() => {
    blocca();
    void queryClient.invalidateQueries({ queryKey: ["cassaforte"] });
  }, [blocca, queryClient]);

  const stato: StatoCassaforte = isPending
    ? "caricamento"
    : !parametri
      ? "non_configurata"
      : chiave
        ? "sbloccata"
        : "bloccata";

  return (
    <Context.Provider value={{ stato, parametri: parametri ?? null, sblocca, blocca, cifra, decifra, ricarica }}>
      {children}
    </Context.Provider>
  );
}
