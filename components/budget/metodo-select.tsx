"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { etichettaMetodo } from "@/lib/metodi-pagamento";

import type { MetodoOpzione } from "./dati";

/** Scelta del metodo di pagamento filtrata per ambito; "" = non indicato. */
export function MetodoSelect({
  metodi,
  ambito,
  value,
  onChange,
  id,
}: {
  metodi: MetodoOpzione[];
  ambito: "lavoro" | "personale";
  value: string;
  onChange: (value: string) => void;
  id?: string;
}) {
  const items = [
    { value: "", label: "Non indicato" },
    ...metodi.filter((m) => m.ambito === "entrambi" || m.ambito === ambito).map((m) => ({ value: m.id, label: etichettaMetodo(m) })),
  ];
  return (
    <Select items={items} value={value} onValueChange={(v) => onChange(String(v ?? ""))}>
      <SelectTrigger id={id} className="w-full" aria-label="Metodo di pagamento">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {items.map((i) => (
          <SelectItem key={i.value} value={i.value}>
            {i.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
