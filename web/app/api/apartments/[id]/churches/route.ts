import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import type { ChurchPlace } from "@/lib/types";

// GET /api/apartments/[id]/churches — TODAS as igrejas com rota a partir deste apê.
// Pivota os modos (walking/driving) numa linha por igreja. Nada é recalculado:
// lê o que o router.js já gravou em routes + places(category='church').
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const churches = await query<ChurchPlace>(
    `select
        p.id,
        p.name,
        max(r.distance_m) filter (where r.mode = 'walking')             as "walkM",
        round(max(r.duration_s) filter (where r.mode = 'walking') / 60.0)::int as "walkMin",
        max(r.distance_m) filter (where r.mode = 'driving')             as "driveM",
        round(max(r.duration_s) filter (where r.mode = 'driving') / 60.0)::int as "driveMin"
       from routes r
       join places p on p.id = r.place_id and p.category = 'church'
      where r.apartment_id = $1
      group by p.id, p.name
      order by max(r.duration_s) filter (where r.mode = 'walking') nulls last, p.name`,
    [id],
  );

  return NextResponse.json(churches);
}
