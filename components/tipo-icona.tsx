import { createElement } from "react";
import type { LucideProps } from "lucide-react";

import { icona } from "@/lib/icone";

/** Icona di un tipo di servizio a partire dal nome salvato nel database. */
export function TipoIcona({ nome, ...props }: { nome: string | null | undefined } & LucideProps) {
  return createElement(icona(nome), props);
}
