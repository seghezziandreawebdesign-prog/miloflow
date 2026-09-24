import { Banknote, CreditCard, Landmark, Wallet, WalletCards, type LucideIcon } from "lucide-react";

import type { Database } from "@/lib/supabase/database.types";

export type TipoMetodo = Database["public"]["Enums"]["tipo_metodo_pagamento"];

export const TIPI_METODO: { value: TipoMetodo; label: string; icon: LucideIcon }[] = [
  { value: "carta_credito", label: "Carta di credito", icon: CreditCard },
  { value: "carta_debito", label: "Carta di debito", icon: CreditCard },
  { value: "prepagata", label: "Carta prepagata", icon: WalletCards },
  { value: "contanti", label: "Contanti", icon: Banknote },
  { value: "conto", label: "Conto / bonifico", icon: Landmark },
  { value: "altro", label: "Altro", icon: Wallet },
];

export function tipoMetodo(value: TipoMetodo) {
  return TIPI_METODO.find((t) => t.value === value) ?? TIPI_METODO[5];
}

/** "Revolut ···4417" oppure "Contanti". */
export function etichettaMetodo(m: { nome: string | null; ultime_cifre?: string | null }): string {
  if (!m.nome) return "—";
  return m.ultime_cifre ? `${m.nome} ···${m.ultime_cifre}` : m.nome;
}
