import { createElement } from "react";

import { icona } from "@/lib/icone";
import { cn } from "@/lib/utils";

/** Cerchio colorato con l'icona della categoria. Senza categoria: grigio. */
export function CategoriaIcona({
  nome,
  colore,
  size = "md",
  className,
}: {
  nome: string | null | undefined;
  colore: string | null | undefined;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const dimensioni = { sm: "size-6 [&_svg]:size-3", md: "size-8 [&_svg]:size-4", lg: "size-11 [&_svg]:size-5" }[size];
  return (
    <span
      aria-hidden
      className={cn("grid shrink-0 place-items-center rounded-full text-white", dimensioni, className)}
      style={{ backgroundColor: colore ?? "#8e8e93" }}
    >
      {createElement(icona(nome))}
    </span>
  );
}
