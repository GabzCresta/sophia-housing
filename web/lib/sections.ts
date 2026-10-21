import {
  Bus,
  Car,
  Church,
  Dumbbell,
  Home,
  Plane,
  Scissors,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  Stethoscope,
  Store,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";

/** As 12 seções da vida — a grade do quadro. Cada uma vira um mini-card clicável;
 *  o conteúdo (do router ou manual) será construído seção a seção. */
export interface Section {
  key: string;
  label: string;
  Icon: LucideIcon;
}

/** Status de uma seção para o pontinho do mini-card:
 *  âmbar = falta você · azul = vez do router · verde = completa. */
export type SectionStatus = "todo" | "router" | "ok";

export const SECTIONS: Section[] = [
  { key: "moradia", label: "Moradia", Icon: Home },
  { key: "supermercado", label: "Supermercado", Icon: ShoppingCart },
  { key: "paki", label: "Paki", Icon: Store },
  { key: "restaurante", label: "Restaurante", Icon: UtensilsCrossed },
  { key: "transporte", label: "Transporte público", Icon: Bus },
  { key: "carro", label: "Carro", Icon: Car },
  { key: "academia", label: "Academia", Icon: Dumbbell },
  { key: "igreja", label: "Igreja", Icon: Church },
  { key: "viajar", label: "Viajar", Icon: Plane },
  { key: "ia", label: "IA", Icon: Sparkles },
  { key: "cabeleireiro", label: "Cabeleireiro", Icon: Scissors },
  { key: "shopping", label: "Shopping", Icon: ShoppingBag },
  { key: "medico", label: "Médico", Icon: Stethoscope },
];
