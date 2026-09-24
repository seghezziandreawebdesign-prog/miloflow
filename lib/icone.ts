import {
  Circle,
  Cloud,
  Ellipsis,
  Globe,
  Landmark,
  Puzzle,
  Repeat,
  Server,
  Shield,
  type LucideIcon,
} from "lucide-react";

// Icone assegnabili ai tipi di servizio (nome lucide salvato nel database).
export const ICONE: Record<string, LucideIcon> = {
  globe: Globe,
  server: Server,
  puzzle: Puzzle,
  cloud: Cloud,
  repeat: Repeat,
  shield: Shield,
  landmark: Landmark,
  ellipsis: Ellipsis,
};

export function icona(nome: string | null | undefined): LucideIcon {
  return (nome && ICONE[nome]) || Circle;
}
