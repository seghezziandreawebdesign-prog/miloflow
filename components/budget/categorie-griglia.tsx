"use client";

import { Check } from "lucide-react";

import { categorieScegliibili, type Categoria } from "@/lib/budget";
import { cn } from "@/lib/utils";

import { CategoriaIcona } from "./categoria-icona";

/**
 * Griglia di categorie con icone, pensata per il telefono: un tocco sceglie.
 * Le sottocategorie stanno sotto il padre come chip. "" = senza categoria.
 */
export function CategorieGriglia({
  categorie,
  ambito,
  value,
  onChange,
  senzaCategoria = true,
}: {
  categorie: Categoria[];
  ambito: "lavoro" | "personale";
  value: string;
  onChange: (id: string) => void;
  senzaCategoria?: boolean;
}) {
  const rami = categorieScegliibili(categorie, ambito);
  if (rami.length === 0) {
    return (
      <p className="rounded-lg bg-muted/60 p-4 text-center text-sm text-muted-foreground">
        Nessuna categoria per questo ambito. Le crei in Impostazioni → Categorie.
      </p>
    );
  }
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {rami.map(({ padre, figlie }) => {
          const attivo = value === padre.id || figlie.some((f) => f.id === value);
          return (
            <button
              key={padre.id}
              type="button"
              onClick={() => onChange(padre.id)}
              aria-pressed={value === padre.id}
              className={cn(
                "flex flex-col items-center gap-1.5 rounded-xl p-2.5 text-center text-xs font-medium ring-1 ring-black/8 ring-inset transition-colors",
                attivo ? "bg-primary-soft text-primary ring-primary/25" : "bg-card hover:bg-muted",
              )}
            >
              <CategoriaIcona nome={padre.icona} colore={padre.colore} size="lg" />
              <span className="line-clamp-2 leading-tight">{padre.nome}</span>
            </button>
          );
        })}
        {senzaCategoria && (
          <button
            type="button"
            onClick={() => onChange("")}
            aria-pressed={value === ""}
            className={cn(
              "flex flex-col items-center gap-1.5 rounded-xl p-2.5 text-center text-xs font-medium ring-1 ring-black/8 ring-inset transition-colors",
              value === "" ? "bg-primary-soft text-primary ring-primary/25" : "bg-card text-muted-foreground hover:bg-muted",
            )}
          >
            <CategoriaIcona nome={null} colore={null} size="lg" className="bg-muted text-muted-foreground" />
            <span className="leading-tight">Nessuna</span>
          </button>
        )}
      </div>
      {rami
        .filter(({ padre, figlie }) => figlie.length > 0 && (value === padre.id || figlie.some((f) => f.id === value)))
        .map(({ padre, figlie }) => (
          <div key={padre.id} className="space-y-1.5">
            <p className="text-xs text-muted-foreground">Più precisamente, in {padre.nome}:</p>
            <div className="flex flex-wrap gap-1.5">
              {figlie.map((f) => {
                const scelta = value === f.id;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => onChange(scelta ? padre.id : f.id)}
                    aria-pressed={scelta}
                    className={cn(
                      "inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px] ring-1 ring-black/8 ring-inset transition-colors",
                      scelta ? "bg-primary-soft font-medium text-primary ring-primary/25" : "bg-card hover:bg-muted",
                    )}
                  >
                    {scelta && <Check className="size-3.5" />}
                    {f.nome}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
    </div>
  );
}
