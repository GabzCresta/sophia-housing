import { NextResponse } from "next/server";
import { queryOne } from "@/lib/db";
import type { MobilityDetail } from "@/lib/types";

// GET /api/apartments/[id]/pillar/mobility — SKEMA nos DOIS modos (carro E transit),
// trajetos (gare/bus/posto/A8) e o perfil de mobilidade (envibus, ônibus direto, garagem).
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const row = await queryOne<MobilityDetail>(
    `select
        (select round(r.duration_s/60.0)::int from routes r
           join places p on p.id=r.place_id and p.category='campus'
          where r.apartment_id=$1 and r.mode='driving' order by r.duration_s limit 1) as campus_drive_min,
        (select round(r.duration_s/60.0)::int from routes r
           join places p on p.id=r.place_id and p.category='campus'
          where r.apartment_id=$1 and r.mode='transit' order by r.duration_s limit 1) as campus_transit_min,
        md.nearest_gare_name, md.nearest_gare_min, md.nearest_bus_stop_min,
        md.nearest_gas_station_min, md.distance_a8_min,
        mp.envibus_lines, mp.direct_bus_to_sophia, mp.building_parking
       from apartments a
       left join v_mobility_derived md on md.apartment_id = a.id
       left join mobility_profile mp on mp.apartment_id = a.id
      where a.id = $1`,
    [id],
  );
  if (!row) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json(row);
}
