import { Building2, CalendarPlus, FolderPlus, ListPlus, ReceiptEuro, RefreshCw, type LucideIcon } from "lucide-react";

// Voci del pulsante "+" e dei comandi rapidi di ⌘K. I form arrivano nelle fasi
// successive: fase indica quando.
export type AzioneCreazione = {
  id: "task" | "progetto" | "spesa" | "servizio" | "evento" | "cliente";
  label: string;
  icon: LucideIcon;
  fase: number;
};

export const AZIONI_CREAZIONE: AzioneCreazione[] = [
  { id: "task", label: "Nuova task", icon: ListPlus, fase: 3 },
  { id: "progetto", label: "Nuovo progetto", icon: FolderPlus, fase: 3 },
  { id: "spesa", label: "Nuova spesa", icon: ReceiptEuro, fase: 5 },
  { id: "servizio", label: "Nuovo servizio", icon: RefreshCw, fase: 2 },
  { id: "evento", label: "Nuovo evento", icon: CalendarPlus, fase: 4 },
  { id: "cliente", label: "Nuovo cliente", icon: Building2, fase: 2 },
];
