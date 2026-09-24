// Tipi di entità apribili nel pannello laterale con ?apri=<tipo>:<id>.

export const TIPI_ENTITA = [
  "cliente",
  "servizio",
  "task",
  "progetto",
  "evento",
  "movimento",
  "debito",
] as const;
export type TipoEntita = (typeof TIPI_ENTITA)[number];

export const ETICHETTE_ENTITA: Record<TipoEntita, string> = {
  cliente: "Cliente",
  servizio: "Servizio",
  task: "Task",
  progetto: "Progetto",
  evento: "Evento",
  movimento: "Movimento",
  debito: "Debito",
};

export const APRI_PARAM = "apri";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type RiferimentoEntita = { tipo: TipoEntita; id: string };

export function parseApri(value: string | null | undefined): RiferimentoEntita | null {
  if (!value) return null;
  const [tipo, id, ...resto] = value.split(":");
  if (resto.length > 0 || !id || !UUID_RE.test(id)) return null;
  if (!TIPI_ENTITA.includes(tipo as TipoEntita)) return null;
  return { tipo: tipo as TipoEntita, id };
}

export function formatApri(ref: RiferimentoEntita): string {
  return `${ref.tipo}:${ref.id}`;
}
