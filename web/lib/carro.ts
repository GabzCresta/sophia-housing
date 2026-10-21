import { num } from "@/lib/format";
import type { CarConfigRow, ConfigData } from "@/lib/types";
import type { SectionStatus } from "@/lib/sections";

/* ── Seção Carro ─────────────────────────────────────────────────────────────
   N carros cadastrados (de qualquer site); o escolhido vive em
   settings.active_car_id. Custo fixo/mês espelha a view v_car_cost:
   mensalidade + amortização de compra (se 'comprar') + seguro + pedágio +
   estacionamento + manutenção. Combustível entra por residência ([auto]). */

export const SCENARIO_PT: Record<string, string> = {
  aluguel_curto: "aluguel curto",
  leasing: "aluguel / leasing",
  comprar: "comprar",
  sem_carro: "sem carro",
};

/** Fixos €/mês do carro — mesma fórmula da view v_car_cost. */
export function carFixedMonthly(c: CarConfigRow): number {
  const buy =
    c.scenario === "comprar" && num(c.months)
      ? ((num(c.purchase_price_eur) ?? 0) - (num(c.resale_estimate_eur) ?? 0)) / (num(c.months) as number)
      : 0;
  return (
    (num(c.monthly_eur) ?? 0) +
    buy +
    (num(c.insurance_eur) ?? 0) +
    (num(c.tolls_eur) ?? 0) +
    (num(c.home_parking_eur) ?? 0) +
    (num(c.maintenance_eur) ?? 0)
  );
}

export function carroStatus(config: ConfigData | null): SectionStatus | null {
  if (!config) return null;
  return config.cars.length > 0 ? "ok" : "todo";
}
