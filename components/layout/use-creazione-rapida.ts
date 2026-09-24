"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { useNuovaSpesa } from "@/components/budget/nuova-spesa";
import { useNuovaTask, useNuovoEvento, useNuovoProgetto } from "@/components/task/nuova-task";
import type { AzioneCreazione } from "@/lib/creazione-rapida";

// Punto unico da cui partono le creazioni (menu +, ⌘K). Le voci il cui form
// non esiste ancora avvisano in quale fase arriveranno.
export function useCreazioneRapida() {
  const router = useRouter();
  const nuovaTask = useNuovaTask();
  const nuovoProgetto = useNuovoProgetto();
  const nuovoEvento = useNuovoEvento();
  const nuovaSpesa = useNuovaSpesa();

  return (azione: AzioneCreazione) => {
    switch (azione.id) {
      case "task":
        nuovaTask();
        return;
      case "progetto":
        nuovoProgetto();
        return;
      case "evento":
        nuovoEvento();
        return;
      case "spesa":
        nuovaSpesa();
        return;
      case "cliente":
        router.push("/clienti?nuovo=1");
        return;
      case "servizio":
        router.push("/servizi?nuovo=1");
        return;
      default:
        toast.info(`${azione.label}: disponibile dalla fase ${azione.fase}`);
    }
  };
}
