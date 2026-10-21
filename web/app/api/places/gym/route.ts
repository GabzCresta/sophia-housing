import { NextResponse } from "next/server";
import { query, queryOne, getSettings } from "@/lib/db";
import { gymAddSchema } from "@/lib/pillar-schemas";
import { measureRoute } from "@/lib/google-server";

// POST /api/places/gym — adiciona uma academia à mão (is_manual=true).
// Vinda do auto-search (com lat/lng + apartment_id), as rotas a pé e de carro
// são medidas NA HORA (Distance Matrix, ~US$0,01) → tempos e gasolina existem
// já no primeiro render. Sem coordenadas, entra sem distâncias (tempos "—").
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "json_invalido" }, { status: 400 });
  }
  const parsed = gymAddSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation", issues: parsed.error.issues }, { status: 400 });
  }
  const d = parsed.data;

  const dup = await queryOne<{ id: string }>(
    d.google_place_id
      ? `select id from places where google_place_id = $1`
      : `select id from places where category = 'gym' and lower(name) = lower($1)`,
    [d.google_place_id ?? d.name],
  );
  if (dup) return NextResponse.json({ error: "academia_ja_existe" }, { status: 409 });

  const place = await queryOne<{ id: string; name: string }>(
    `insert into places (category, name, address, lat, lng, google_place_id, rating, is_manual)
       values ('gym', $1, $2, $3, $4, $5, $6, true)
     returning id, name`,
    [d.name, d.address ?? null, d.lat ?? null, d.lng ?? null, d.google_place_id ?? null, d.rating ?? null],
  );
  if (d.monthly_fee_eur != null) {
    await query(`insert into gym_details (place_id, monthly_fee_eur) values ($1, $2)`, [
      place!.id,
      d.monthly_fee_eur,
    ]);
  }

  // Auto-search completo → mede as rotas do apê aberto agora mesmo.
  let measured = false;
  if (d.lat != null && d.lng != null && d.apartment_id) {
    const apt = await queryOne<{ lat: number | null; lng: number | null }>(
      `select lat, lng from apartments where id = $1`,
      [d.apartment_id],
    );
    if (apt?.lat != null && apt?.lng != null) {
      const origin = { lat: Number(apt.lat), lng: Number(apt.lng) };
      const dest = { lat: d.lat, lng: d.lng };
      const settings = await getSettings(["fuel_price_eur_per_l", "car_consumption_l_per_100km"]);
      const fuelPrice = Number(settings.fuel_price_eur_per_l ?? 0);
      const consumption = Number(settings.car_consumption_l_per_100km ?? 0);

      for (const mode of ["driving", "walking"] as const) {
        const r = await measureRoute(origin, dest, mode);
        if (!r) continue;
        const fuel =
          mode === "driving" && fuelPrice && consumption
            ? (r.distance_m / 1000) * (consumption / 100) * fuelPrice
            : null;
        await query(
          `insert into routes (apartment_id, place_id, mode, distance_m, duration_s, fuel_cost_eur, computed_at)
             values ($1, $2, $3, $4, $5, $6, now())
           on conflict (apartment_id, place_id, mode) do update
             set distance_m = excluded.distance_m, duration_s = excluded.duration_s,
                 fuel_cost_eur = excluded.fuel_cost_eur, computed_at = now(), updated_at = now()`,
          [d.apartment_id, place!.id, mode, r.distance_m, r.duration_s, fuel],
        );
        measured = true;
      }
    }
  }

  return NextResponse.json({ ...place, measured }, { status: 201 });
}
