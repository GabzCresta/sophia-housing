import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import type { GymOption } from "@/lib/types";

// GET /api/apartments/[id]/pillar/gym — TODAS as academias (com rota medida OU
// adicionadas à mão, que ainda não têm tempos), com nota do Google, tempos,
// mensalidade editável e qual é "a minha". Parte de places (LEFT JOIN routes)
// para a academia manual aparecer mesmo antes de o router medir.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const rows = await query<GymOption>(
    `select
        p.id,
        p.name,
        p.rating,
        round(max(r.duration_s) filter (where r.mode = 'walking') / 60.0)::int as "walkMin",
        round(max(r.duration_s) filter (where r.mode = 'driving') / 60.0)::int as "driveMin",
        round(max(r.distance_m) filter (where r.mode = 'driving'))::int as "driveM",
        (sel.place_id is not null) as selected,
        gd.monthly_fee_eur,
        gd.quality_1_5
       from places p
       left join routes r on r.place_id = p.id and r.apartment_id = $1
       left join gym_details gd on gd.place_id = p.id
       left join apartment_selections sel
              on sel.place_id = p.id and sel.apartment_id = $1 and sel.category = 'gym'
      where p.category = 'gym'
      group by p.id, p.name, p.rating, p.is_manual, sel.place_id, gd.monthly_fee_eur, gd.quality_1_5
      -- padrão: sem rota medida p/ ESTE apê, só manuais aparecem (consistente com as outras listas)
      having count(r.id) > 0 or p.is_manual
      order by min(r.duration_s) nulls last, p.name`,
    [id],
  );
  return NextResponse.json(rows);
}
