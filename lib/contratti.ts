import type { Database } from "@/lib/supabase/database.types";

export type StatoContratto = Database["public"]["Enums"]["stato_contratto"];

export const STATI_CONTRATTO: { value: StatoContratto; label: string; className: string }[] = [
  { value: "attivo", label: "Attivo", className: "bg-emerald-50 text-emerald-700 ring-emerald-600/20" },
  { value: "concluso", label: "Concluso", className: "bg-muted text-muted-foreground ring-black/8" },
];

export function statoContratto(value: StatoContratto) {
  return STATI_CONTRATTO.find((s) => s.value === value) ?? STATI_CONTRATTO[0];
}
