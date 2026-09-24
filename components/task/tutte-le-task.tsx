"use client";

import { Columns3, List } from "lucide-react";

import { Segmented } from "@/components/segmented";
import type { FiltroAmbito } from "@/lib/ambito";
import { useLocalPreference } from "@/lib/use-local-preference";

import { Board } from "./board";
import { TutteTabella } from "./tutte-tabella";

type Modo = "lista" | "board";

export function useModoTutte() {
  return useLocalPreference<Modo>("task.tutte", ["lista", "board"], "lista");
}

/** Switch Lista / Board, condiviso dalla voce "Tutte le task" e dai progetti. */
export function SwitchListaBoard({ value, onChange }: { value: Modo; onChange: (v: Modo) => void }) {
  return (
    <Segmented
      label="Vista"
      value={value}
      onChange={onChange}
      opzioni={[
        { value: "lista", label: "Lista", icon: List },
        { value: "board", label: "Board", icon: Columns3 },
      ]}
      className="[&>p]:sr-only"
    />
  );
}

/** Voce generica "Tutte le task": tabella con filtri oppure kanban. */
export function TutteLeTask({ filtroAmbito, modo }: { filtroAmbito: FiltroAmbito; modo: Modo }) {
  return modo === "board" ? <Board filtroAmbito={filtroAmbito} /> : <TutteTabella filtroAmbito={filtroAmbito} />;
}
