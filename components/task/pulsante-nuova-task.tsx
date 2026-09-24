"use client";

import { FolderPlus, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { TaskFormValues } from "@/lib/schemas/task";

import { useNuovaTask, useNuovoProgetto } from "./nuova-task";

/** Pulsante "Nuova task" con eventuali valori già impostati dal contesto. */
export function PulsanteNuovaTask({
  valori,
  variant = "default",
  label = "Nuova task",
}: {
  valori?: Partial<TaskFormValues>;
  variant?: "default" | "outline";
  label?: string;
}) {
  const nuovaTask = useNuovaTask();
  return (
    <Button variant={variant} onClick={() => nuovaTask(valori)}>
      <Plus />
      {label}
    </Button>
  );
}

/** Pulsante "Nuovo progetto". */
export function PulsanteNuovoProgetto({ clienteId, variant = "outline" }: { clienteId?: string; variant?: "default" | "outline" }) {
  const nuovoProgetto = useNuovoProgetto();
  return (
    <Button variant={variant} onClick={() => nuovoProgetto({ cliente_id: clienteId })}>
      <FolderPlus />
      Nuovo progetto
    </Button>
  );
}
