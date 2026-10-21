import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { carConfigSchema } from "@/lib/config-schemas";
import type { CarConfigRow } from "@/lib/types";

const RETURNING = `id, scenario, source, model, km_included, monthly_eur, purchase_price_eur,
                   resale_estimate_eur, months, insurance_eur, insurance_deductible_eur, tolls_eur,
                   home_parking_eur, maintenance_eur`;

// POST /api/config/car — cadastra UM carro (de qualquer site). Vários carros
// podem coexistir (inclusive do mesmo cenário); o escolhido vive em
// settings.active_car_id.
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "json_invalido" }, { status: 400 });
  }
  const parsed = carConfigSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation", issues: parsed.error.issues }, { status: 400 });
  }
  const d = parsed.data;
  const row = (
    await query<CarConfigRow>(
      `insert into car_config (scenario, source, model, km_included, monthly_eur, purchase_price_eur,
                               resale_estimate_eur, months, insurance_eur, insurance_deductible_eur,
                               tolls_eur, home_parking_eur, maintenance_eur)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       returning ${RETURNING}`,
      [
        d.scenario,
        d.source ?? null,
        d.model ?? null,
        d.km_included ?? null,
        d.monthly_eur ?? null,
        d.purchase_price_eur ?? null,
        d.resale_estimate_eur ?? null,
        d.months ?? null,
        d.insurance_eur ?? null,
        d.insurance_deductible_eur ?? null,
        d.tolls_eur ?? null,
        d.home_parking_eur ?? null,
        d.maintenance_eur ?? null,
      ],
    )
  )[0];
  return NextResponse.json(row, { status: 201 });
}
