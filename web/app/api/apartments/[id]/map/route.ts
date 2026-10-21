import { NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import type { MapData, MapPin } from "@/lib/types";

// GET /api/apartments/[id]/map — o sol + os pins do céu: as seleções "esta é a
// minha" (qualquer categoria) e os pontos fixos da vida (campus, gares, hubs),
// com os tempos já medidos em routes. O front não renderiza o mapa se o apê
// ainda não tem lat/lng (residência não medida).
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const apartment = await queryOne<MapData["apartment"]>(
    `select id, name, lat, lng from apartments where id = $1`,
    [id],
  );
  if (!apartment) {
    return NextResponse.json({ error: "nao_encontrado" }, { status: 404 });
  }

  const pins = await query<MapPin>(
    `with times as (
       select r.place_id,
              round(max(r.duration_s) filter (where r.mode = 'walking') / 60.0)::int as "walkMin",
              round(max(r.duration_s) filter (where r.mode = 'driving') / 60.0)::int as "driveMin"
         from routes r
        where r.apartment_id = $1
        group by r.place_id
     )
     select p.id, p.name, p.category, p.lat, p.lng,
            t."walkMin", t."driveMin",
            (sel.id is not null) as selected
       from places p
       left join apartment_selections sel
              on sel.place_id = p.id and sel.apartment_id = $1 and sel.category = p.category
       left join times t on t.place_id = p.id
      where p.lat is not null and p.lng is not null
        and (sel.id is not null or p.category in ('campus','gare','travel_hub'))
      order by p.category, p.name`,
    [id],
  );

  return NextResponse.json({ apartment, pins } satisfies MapData);
}
