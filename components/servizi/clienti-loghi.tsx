import { ClienteLogo } from "@/components/clienti/cliente-logo";

/** Loghi dei clienti collegati, sovrapposti. */
export function ClientiLoghi({
  clienti,
  max = 3,
}: {
  clienti: { id: string; nome: string; colore: string | null; sito: string | null; logo_url: string | null }[];
  max?: number;
}) {
  if (clienti.length === 0) return null;
  const visibili = clienti.slice(0, max);
  return (
    <div className="flex items-center" title={clienti.map((c) => c.nome).join(", ")}>
      {visibili.map((c, i) => (
        <ClienteLogo
          key={c.id}
          nome={c.nome}
          colore={c.colore}
          logoUrl={c.logo_url}
          sito={c.sito}
          size="sm"
          className={i > 0 ? "-ml-2 ring-2 ring-background" : "ring-2 ring-background"}
        />
      ))}
      {clienti.length > max && (
        <span className="-ml-2 grid size-8 place-items-center rounded-md bg-muted text-xs ring-2 ring-background">
          +{clienti.length - max}
        </span>
      )}
    </div>
  );
}
