import { NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import type {
  ApartmentCosts,
  ApartmentOverview,
  CostOfLiving,
  DiscountSupermarket,
  MobilityDerived,
  NearestPlace,
  StudyAccess,
  TravelHub,
} from "@/lib/types";

// GET /api/apartments/[id]/overview — o apê + seus pilares recalculados (das views).
// É a fonte do "trocar o sol": tudo aqui é relativo a ESTE apartment_id.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const apartment = await queryOne<ApartmentOverview["apartment"]>(
    `select id, name, address, lat, lng, city, neighborhood, status, unit_type, area_m2,
            rent_base_eur, charges_eur, charges_type,
            deposit_eur, apl_estimate_eur, brightness_1_5, noise_1_5, pros, cons, personal_notes, routes_stale
       from apartments where id = $1`,
    [id],
  );
  if (!apartment) return NextResponse.json({ error: "not_found" }, { status: 404 });

  // Os pilares vêm das views — todos filtrados por este apartment_id.
  const [cost, costs, nearest, mobility, study, discountSupermarket, travelHubs] = await Promise.all([
    queryOne<CostOfLiving>(
      `select rent_effective_eur, food_eur, fuel_campus_eur, car_fixed_eur, ai_eur, transit_eur, gym_eur, total_month_eur, has_car
         from v_apartment_cost_of_living where apartment_id = $1`,
      [id],
    ),
    queryOne<ApartmentCosts>(
      `select rent_total_eur, entry_cost_eur, effective_cost_eur
         from v_apartment_costs where apartment_id = $1`,
      [id],
    ),
    query<NearestPlace>(
      `select category, place_name, mode, duration_min, distance_m
         from v_apartment_nearest where apartment_id = $1 order by category`,
      [id],
    ),
    queryOne<MobilityDerived>(
      `select nearest_bus_stop_min, nearest_gare_min, nearest_gare_name, nearest_gas_station_min, distance_a8_min
         from v_mobility_derived where apartment_id = $1`,
      [id],
    ),
    queryOne<StudyAccess>(
      `select nearest_library_min, campus_library_min
         from v_study_access where apartment_id = $1`,
      [id],
    ),
    queryOne<DiscountSupermarket>(
      `select place_name, price_index, duration_min
         from v_apartment_supermarket where apartment_id = $1`,
      [id],
    ),
    query<TravelHub>(
      `select p.name, thd.hub_type, round(r.duration_s / 60.0)::int as duration_min
         from places p
         join travel_hub_details thd on thd.place_id = p.id
         join routes r on r.place_id = p.id and r.apartment_id = $1 and r.mode = 'driving'
        where p.category = 'travel_hub'
        order by r.duration_s`,
      [id],
    ),
  ]);

  const overview: ApartmentOverview = {
    apartment,
    cost,
    costs,
    nearest,
    mobility,
    study,
    discountSupermarket,
    travelHubs,
  };
  return NextResponse.json(overview);
}
