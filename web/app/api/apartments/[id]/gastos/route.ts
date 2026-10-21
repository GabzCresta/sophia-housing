import { NextResponse } from "next/server";
import { query, queryOne, getSettings } from "@/lib/db";

/* GET /api/apartments/[id]/gastos — as 12 fatias do "preço desta vida".
   Fontes: aluguel efetivo (view), budgets (settings), passe (transit_config),
   carro ativo (car_config), mensalidade da academia escolhida (view) e a
   GASOLINA TOTAL inteligente: campus (view, × dias de aula) + mercado/academia/
   igreja ESCOLHIDOS × frequência que ele informou × distância medida.
   É um resumo do PREENCHIDO — passe e carro aparecem juntos se ambos existem. */

export interface GastoSlice {
  key: string;
  label: string;
  value: number | null; // null = ainda não preenchido
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [costs, col, transit, ai, s] = await Promise.all([
    queryOne<{ effective_cost_eur: string | null }>(
      `select effective_cost_eur from v_apartment_costs where apartment_id = $1`,
      [id],
    ),
    queryOne<{ fuel_campus_eur: string | null; gym_eur: string | null }>(
      `select fuel_campus_eur, gym_eur from v_apartment_cost_of_living where apartment_id = $1`,
      [id],
    ),
    queryOne<{ student_pass_eur: string | null }>(
      `select student_pass_eur from transit_config order by created_at desc limit 1`,
    ),
    queryOne<{ total: string | null }>(`select sum(monthly_eur) as total from ai_subscriptions`),
    getSettings([
      "supermarket_budget_eur",
      "restaurant_budget_eur",
      "travel_budget_eur",
      "hair_budget_eur",
      "shopping_budget_eur",
      "health_budget_eur",
      "supermarket_trips_per_month",
      "gym_trips_per_month",
      "church_trips_per_month",
      "fuel_price_eur_per_l",
      "car_consumption_l_per_100km",
      "active_car_scenario",
      "active_car_id",
    ]),
  ]);

  const n = (v: unknown): number | null => {
    if (v === null || v === undefined || v === "") return null;
    const x = Number(v);
    return Number.isFinite(x) ? x : null;
  };

  // Carro ativo: fixos/mês (mesma fórmula da view v_car_cost).
  const semCarro = (s.active_car_scenario ?? "sem_carro") === "sem_carro";
  let carro: number | null = null;
  if (!semCarro && s.active_car_id) {
    const car = await queryOne<{ total: string | null }>(
      `select coalesce(monthly_eur, 0)
              + case when scenario = 'comprar' and coalesce(months, 0) > 0
                     then (coalesce(purchase_price_eur, 0) - coalesce(resale_estimate_eur, 0)) / months
                     else 0 end
              + coalesce(insurance_eur, 0) + coalesce(tolls_eur, 0)
              + coalesce(home_parking_eur, 0) + coalesce(maintenance_eur, 0) as total
         from car_config where id = $1`,
      [s.active_car_id],
    );
    carro = n(car?.total);
  }

  // Gasolina inteligente: distância de carro dos lugares ESCOLHIDOS × frequência.
  const fuelPrice = n(s.fuel_price_eur_per_l);
  const consumption = n(s.car_consumption_l_per_100km);
  const trips: Record<string, number | null> = {
    supermarket: n(s.supermarket_trips_per_month),
    gym: n(s.gym_trips_per_month),
    church: n(s.church_trips_per_month),
  };
  const dists = await query<{ category: string; distance_m: string }>(
    `select sel.category::text as category, max(r.distance_m) as distance_m
       from apartment_selections sel
       join routes r on r.place_id = sel.place_id and r.apartment_id = sel.apartment_id and r.mode = 'driving'
      where sel.apartment_id = $1 and sel.category in ('supermarket', 'gym', 'church')
      group by sel.category`,
    [id],
  );
  let gasolina = n(col?.fuel_campus_eur) ?? 0; // campus × dias de aula (0 se sem carro)
  for (const d of dists) {
    const t = trips[d.category];
    const km = n(d.distance_m);
    if (t !== null && km !== null && fuelPrice !== null && consumption !== null) {
      gasolina += (km / 1000) * 2 * t * (consumption / 100) * fuelPrice;
    }
  }

  const slices: GastoSlice[] = [
    { key: "moradia", label: "Moradia", value: n(costs?.effective_cost_eur) },
    { key: "supermercado", label: "Supermercado", value: n(s.supermarket_budget_eur) },
    { key: "restaurante", label: "Restaurante", value: n(s.restaurant_budget_eur) },
    { key: "transporte", label: "Transporte público", value: n(transit?.student_pass_eur) },
    { key: "carro", label: "Carro", value: carro },
    { key: "gasolina", label: "Gasolina total", value: gasolina > 0 ? Math.round(gasolina * 100) / 100 : gasolina === 0 && !semCarro ? 0 : null },
    { key: "academia", label: "Academia", value: n(col?.gym_eur) },
    { key: "viagem", label: "Viagem", value: n(s.travel_budget_eur) },
    { key: "ia", label: "IA", value: n(ai?.total) },
    { key: "cabeleireiro", label: "Cabeleireiro", value: n(s.hair_budget_eur) },
    { key: "shopping", label: "Shopping", value: n(s.shopping_budget_eur) },
    { key: "medico", label: "Médico", value: n(s.health_budget_eur) },
  ];
  const total = slices.reduce((acc, sl) => acc + (sl.value ?? 0), 0);
  return NextResponse.json({ total: Math.round(total * 100) / 100, slices });
}
