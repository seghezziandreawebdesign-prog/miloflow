// Switch di ambito globale (Tutto / Lavoro / Personale), salvato in un cookie.

export const AMBITO_COOKIE = "ambito";

export const FILTRI_AMBITO = ["tutto", "lavoro", "personale"] as const;
export type FiltroAmbito = (typeof FILTRI_AMBITO)[number];
export type Ambito = Exclude<FiltroAmbito, "tutto">;

export const ETICHETTE_AMBITO: Record<FiltroAmbito, string> = {
  tutto: "Tutto",
  lavoro: "Lavoro",
  personale: "Personale",
};

export function parseFiltroAmbito(value: string | undefined): FiltroAmbito {
  return FILTRI_AMBITO.includes(value as FiltroAmbito) ? (value as FiltroAmbito) : "tutto";
}

// Ambito proposto quando si crea un elemento: quello attivo, o lavoro se "Tutto".
export function ambitoDiDefault(filtro: FiltroAmbito): Ambito {
  return filtro === "tutto" ? "lavoro" : filtro;
}
