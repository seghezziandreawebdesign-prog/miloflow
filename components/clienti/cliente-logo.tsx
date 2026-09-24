"use client";

import { useState, useSyncExternalStore } from "react";

import { hostDelSito, iniziali } from "@/lib/clienti";
import { cn } from "@/lib/utils";

const noopSubscribe = () => () => {};

const SIZES = {
  sm: "size-8 text-xs rounded-md",
  md: "size-10 text-sm rounded-lg",
  lg: "size-16 text-lg rounded-xl",
} as const;

/**
 * Logo del cliente con due ripieghi: la favicon presa dal sito stesso
 * (nessun servizio terzo), poi le iniziali sul colore del cliente.
 */
export function ClienteLogo({
  nome,
  colore,
  logoUrl,
  sito,
  size = "md",
  className,
}: {
  nome: string;
  colore: string | null;
  logoUrl: string | null;
  sito: string | null;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const host = hostDelSito(sito);
  const candidati = [logoUrl, host ? `https://${host}/favicon.ico` : null].filter(
    (u): u is string => Boolean(u),
  );
  const [falliti, setFalliti] = useState<string[]>([]);
  // Le immagini si montano solo nel browser: se venissero dal server potrebbero
  // fallire prima che React colleghi onError, lasciando un riquadro vuoto.
  const idratato = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const src = idratato ? candidati.find((u) => !falliti.includes(u)) : undefined;
  const box = cn("grid shrink-0 place-items-center overflow-hidden", SIZES[size], className);

  if (src) {
    const isFavicon = src !== logoUrl;
    return (
      <span className={cn(box, "bg-background ring-1 ring-black/8")}>
        {/* eslint-disable-next-line @next/next/no-img-element -- URL firmati e favicon esterne */}
        <img
          src={src}
          alt=""
          className={isFavicon ? "size-1/2 object-contain" : "size-full object-contain p-0.5"}
          onError={() => setFalliti((f) => [...f, src])}
          referrerPolicy="no-referrer"
        />
      </span>
    );
  }

  return (
    <span
      aria-hidden
      className={cn(box, "font-semibold text-white")}
      style={{ backgroundColor: colore ?? "var(--color-muted-foreground)" }}
    >
      {iniziali(nome)}
    </span>
  );
}
