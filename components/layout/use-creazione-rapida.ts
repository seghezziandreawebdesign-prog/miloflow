"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";

import type { AzioneCreazione } from "@/lib/creazione-rapida";

// Punto unico da cui partono le creazioni (menu +, ⌘K). Le voci il cui form
// non esiste ancora avvisano in quale fase arriveranno.
export function useCreazioneRapida() {
  const router = useRouter();

  return (azione: AzioneCreazione) => {
    switch (azione.id) {
      case "cliente":
        router.push("/clienti?nuovo=1");
        return;
      default:
        toast.info(`${azione.label}: disponibile dalla fase ${azione.fase}`);
    }
  };
}
