"use client";

import { X } from "lucide-react";
import { useId, useState } from "react";

import { Input } from "@/components/ui/input";

/** Tag liberi: Invio o virgola per aggiungere, suggerimenti dai tag già usati. */
export function TagsInput({
  value,
  onChange,
  suggestions = [],
  id,
}: {
  value: string[];
  onChange: (value: string[]) => void;
  suggestions?: string[];
  id?: string;
}) {
  const [draft, setDraft] = useState("");
  const listId = useId();

  function add(raw: string) {
    const tag = raw.trim().toLowerCase();
    if (tag && !value.includes(tag)) onChange([...value, tag]);
    setDraft("");
  }

  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((tag) => (
            <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-muted py-0.5 pr-1 pl-2.5 text-xs">
              {tag}
              <button
                type="button"
                onClick={() => onChange(value.filter((t) => t !== tag))}
                className="rounded-full p-0.5 hover:bg-foreground/10"
                aria-label={`Rimuovi ${tag}`}
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <Input
        id={id}
        list={listId}
        value={draft}
        placeholder="Aggiungi un tag e premi Invio"
        onChange={(e) => {
          const next = e.target.value;
          if (next.endsWith(",")) add(next.slice(0, -1));
          else setDraft(next);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            add(draft);
          } else if (e.key === "Backspace" && draft === "" && value.length > 0) {
            onChange(value.slice(0, -1));
          }
        }}
        onBlur={() => draft && add(draft)}
      />
      <datalist id={listId}>
        {suggestions
          .filter((s) => !value.includes(s))
          .map((s) => (
            <option key={s} value={s} />
          ))}
      </datalist>
    </div>
  );
}
