import {
  Building2,
  CalendarDays,
  ListChecks,
  RefreshCw,
  Settings,
  Sun,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export type VoceNavigazione = { href: string; label: string; icon: LucideIcon };

export const NAVIGAZIONE: VoceNavigazione[] = [
  { href: "/oggi", label: "Oggi", icon: Sun },
  { href: "/task", label: "Task", icon: ListChecks },
  { href: "/calendario", label: "Calendario", icon: CalendarDays },
  { href: "/clienti", label: "Clienti", icon: Building2 },
  { href: "/servizi", label: "Servizi & Scadenze", icon: RefreshCw },
  { href: "/budget", label: "Budget", icon: Wallet },
  { href: "/impostazioni", label: "Impostazioni", icon: Settings },
];
