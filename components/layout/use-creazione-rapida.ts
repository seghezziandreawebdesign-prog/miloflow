"use client";

import { toast } from "sonner";

import type { AzioneCreazione } from "@/lib/creazione-rapida";

// Punto unico da cui partono le creazioni (menu +, ⌘K). Per ora i form non
// esistono ancora: si avvisa in quale fase arriveranno.
export function useCreazioneRapida() {
  return (azione: AzioneCreazione) => {
    toast.info(`${azione.label}: disponibile dalla fase ${azione.fase}`);
  };
}
