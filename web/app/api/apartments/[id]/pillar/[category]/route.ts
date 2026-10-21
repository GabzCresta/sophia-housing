import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import type { PlaceOption } from "@/lib/types";

// Colunas de detalhe (1:1 por place) e joins por categoria. Genérico p/ os pilares geográficos.
const DETAILS: Record<string, { cols: string; join: string }> = {
  supermarket: {
    cols: "sd.is_discount, sd.price_index, sd.chain, sd.market_type",
    join: "left join supermarket_details sd on sd.place_id = b.id",
  },
  restaurant: {
    cols: "mc.meal_cost_eur, rd.cuisine, rd.price_level",
    join: "left join restaurant_details rd on rd.place_id = b.id left join v_restaurant_meal_cost mc on mc.place_id = b.id",
  },
  church: {
    cols: "cd.has_english_mass, cd.mass_times_sunday, cd.language",
    join: "left join church_details cd on cd.place_id = b.id",
  },
  coworking: { cols: "", join: "" },
  hair_salon: { cols: "", join: "" },
  shopping_mall: { cols: "", join: "" },
  hospital: { cols: "", join: "" },
  pharmacy: { cols: "", join: "" },
  paki: { cols: "", join: "" }, // mercearia de bairro — só a lista, sem detalhes
};

// GET /api/apartments/[id]/pillar/[category] — lista completa daquele pilar: nota do Google,
// tempos (a pé/carro), "esta é a minha", e os detalhes específicos da categoria.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; category: string }> },
) {
  const { id, category } = await params;
  // DETAILS é a whitelist de categorias listáveis (nem toda listável tem seleção — ex. shopping).
  if (!DETAILS[category]) {
    return NextResponse.json({ error: "categoria_invalida" }, { status: 400 });
  }
  const d = DETAILS[category];
  const extraCols = d.cols ? `, ${d.cols}` : "";

  const rows = await query<PlaceOption>(
    `with base as (
       select p.id, p.name, p.rating, p.google_place_id,
              round(max(r.duration_s) filter (where r.mode = 'walking') / 60.0)::int as "walkMin",
              round(max(r.duration_s) filter (where r.mode = 'driving') / 60.0)::int as "driveMin",
              round(max(r.distance_m) filter (where r.mode = 'driving'))::int as "driveM",
              min(r.duration_s) as min_s
         from routes r
         join places p on p.id = r.place_id and p.category = $2::place_category
        where r.apartment_id = $1
        group by p.id, p.name, p.rating, p.google_place_id
     )
     select b.id, b.name, b.rating, b.google_place_id, b."walkMin", b."driveMin", b."driveM",
            (sel.place_id is not null) as selected${extraCols}
       from base b
       left join apartment_selections sel
              on sel.place_id = b.id and sel.apartment_id = $1 and sel.category = $2::place_category
       ${d.join}
      order by b.min_s nulls last, b.name`,
    [id, category],
  );
  return NextResponse.json(rows);
}
