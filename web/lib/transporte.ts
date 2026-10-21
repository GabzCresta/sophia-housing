import type { ConfigData } from "@/lib/types";
import type { SectionStatus } from "@/lib/sections";

/* ── Seção Transporte público ────────────────────────────────────────────────
   Os planos da região, pesquisados nos sites OFICIAIS em 2026-07-11 (preços
   mudam — os links ficam na seção). Escolher um grava o preço mensal em
   transit_config.student_pass_eur (é de lá que o custo de vida lê). */

export interface TransitPlan {
  key: string;
  name: string;
  operator: string;
  monthlyEur: number; // equivalente mensal gravado ao escolher (editável depois)
  priceLabel: string; // como o preço é anunciado de verdade
  covers: string;
  note?: string;
  url: string;
}

export const TRANSIT_PLANS: TransitPlan[] = [
  {
    key: "zou_etudes",
    name: "PASS ZOU! Études",
    operator: "Região Sud (TER + ônibus ZOU)",
    monthlyEur: 7.5,
    priceLabel: "€90/ano ≈ €7,50/mês",
    covers: "Trem TER + ônibus regionais ILIMITADOS na região inteira (Antibes↔Biot/Sophia, Nice, Cannes…)",
    note: "estudantes de 3 a 25 anos · vale 1/set → 31/ago (seu ano letivo exato)",
    url: "https://zou.maregionsud.fr/en/decouvrez-pass-zou-etudes/",
  },
  {
    key: "envibus_anual",
    name: "Envibus Pass Anual",
    operator: "Envibus (CASA — Antibes/Juan-les-Pins/Sophia)",
    monthlyEur: 7.5,
    priceLabel: "€90/ano ≈ €7,50/mês",
    covers: "Ônibus locais da agglo ilimitados — inclui as linhas até o campus Sophia",
    url: "https://www.envibus.fr/acheter-un-titre/gamme-tarifaire",
  },
  {
    key: "envibus_mensal",
    name: "Envibus Pass Mensal",
    operator: "Envibus (CASA)",
    monthlyEur: 12,
    priceLabel: "€12/mês",
    covers: "Ônibus locais da agglo ilimitados, sem compromisso anual",
    url: "https://www.envibus.fr/acheter-un-titre/gamme-tarifaire",
  },
  {
    key: "combo_zou_envibus",
    name: "Combo: ZOU! Études + Envibus Anual",
    operator: "Região Sud + Envibus",
    monthlyEur: 15,
    priceLabel: "€180/ano ≈ €15/mês",
    covers: "Trem ilimitado (região) + ônibus local ilimitado — cobre campus, Nice, Cannes e o dia a dia",
    note: "o equivalente completo do seu T-mobilitat de Barcelona (€43/mês) por ~1/3 do preço",
    url: "https://zou.maregionsud.fr/en/decouvrez-pass-zou-etudes/",
  },
  {
    key: "azur_mensuel",
    name: "Azur Mensuel",
    operator: "Multirede Côte d'Azur",
    monthlyEur: 52,
    priceLabel: "€52/mês",
    covers: "Ônibus urbanos de várias redes da Côte d'Azur (Envibus + Nice + Cannes) num título só",
    url: "https://www.envibus.fr/acheter-un-titre/gamme-tarifaire",
  },
  {
    key: "sudazur_mensuel",
    name: "SudAzur Mensuel",
    operator: "Região Sud (zonal, trem + ônibus)",
    monthlyEur: 27,
    priceLabel: "€27/mês (1 zona) até €88/mês (7 zonas)",
    covers: "Um cartão só para trem + ônibus, por zonas — ajuste o preço à sua zona depois de escolher",
    url: "https://www.envibus.fr/acheter-un-titre/gamme-tarifaire",
  },
  {
    key: "avulso",
    name: "Sem assinatura (avulso)",
    operator: "Envibus",
    monthlyEur: 16,
    priceLabel: "€1/viagem no app · 10 viagens €8",
    covers: "Para quem quase não usa — estimativa de €16/mês (~16 viagens); ajuste ao seu uso",
    url: "https://www.envibus.fr/acheter-un-titre/gamme-tarifaire",
  },
];

/** Verde quando há um passe com preço definido (transit_config.student_pass_eur). */
export function transporteStatus(config: ConfigData | null): SectionStatus | null {
  if (!config) return null;
  return config.transit?.student_pass_eur != null ? "ok" : "todo";
}
