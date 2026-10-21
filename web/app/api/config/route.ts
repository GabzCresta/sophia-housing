import { NextResponse } from "next/server";
import { query, queryOne, getSettings } from "@/lib/db";
import type { AiSubscription, CarConfigRow, ConfigData } from "@/lib/types";

// GET /api/config — estado completo do painel "Ajustes" numa leitura só.
export async function GET() {
  const [aiSubscriptions, food, transit, cars, settings] = await Promise.all([
    query<AiSubscription>(
      `select id, name, monthly_eur from ai_subscriptions order by created_at`,
    ),
    queryOne<ConfigData["food"]>(
      `select monthly_realistic_eur, monthly_optimized_eur, buy_profile
         from food_profile order by created_at desc limit 1`,
    ),
    queryOne<ConfigData["transit"]>(
      `select student_pass_eur from transit_config order by created_at desc limit 1`,
    ),
    query<CarConfigRow>(
      `select id, scenario, source, model, km_included, monthly_eur, purchase_price_eur,
              resale_estimate_eur, months, insurance_eur, insurance_deductible_eur, tolls_eur,
              home_parking_eur, maintenance_eur
         from car_config order by created_at`,
    ),
    getSettings([
      "fuel_price_eur_per_l",
      "car_consumption_l_per_100km",
      "active_car_scenario",
      "food_mode",
      "mass_availability_window",
      "supermarket_budget_eur",
      "restaurant_budget_eur",
      "transit_plan",
      "active_car_id",
      "supermarket_trips_per_month",
      "gym_trips_per_month",
      "church_trips_per_month",
      "travel_budget_eur",
      "hair_budget_eur",
      "shopping_budget_eur",
      "health_budget_eur",
    ]),
  ]);

  const data: ConfigData = {
    aiSubscriptions,
    food,
    transit,
    cars,
    settings: {
      fuel_price_eur_per_l: settings.fuel_price_eur_per_l ? Number(settings.fuel_price_eur_per_l) : null,
      car_consumption_l_per_100km: settings.car_consumption_l_per_100km
        ? Number(settings.car_consumption_l_per_100km)
        : null,
      active_car_scenario: settings.active_car_scenario ?? "sem_carro",
      food_mode: settings.food_mode ?? "realista",
      mass_availability_window: settings.mass_availability_window ?? null,
      supermarket_budget_eur: settings.supermarket_budget_eur ? Number(settings.supermarket_budget_eur) : null,
      restaurant_budget_eur: settings.restaurant_budget_eur ? Number(settings.restaurant_budget_eur) : null,
      transit_plan: settings.transit_plan ?? null,
      active_car_id: settings.active_car_id ?? null,
      supermarket_trips_per_month: settings.supermarket_trips_per_month
        ? Number(settings.supermarket_trips_per_month)
        : null,
      gym_trips_per_month: settings.gym_trips_per_month ? Number(settings.gym_trips_per_month) : null,
      church_trips_per_month: settings.church_trips_per_month ? Number(settings.church_trips_per_month) : null,
      travel_budget_eur: settings.travel_budget_eur ? Number(settings.travel_budget_eur) : null,
      hair_budget_eur: settings.hair_budget_eur ? Number(settings.hair_budget_eur) : null,
      shopping_budget_eur: settings.shopping_budget_eur ? Number(settings.shopping_budget_eur) : null,
      health_budget_eur: settings.health_budget_eur ? Number(settings.health_budget_eur) : null,
    },
  };
  return NextResponse.json(data);
}
