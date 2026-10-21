import { NextResponse } from "next/server";
import { setSetting } from "@/lib/db";
import { settingsPatchSchema } from "@/lib/config-schemas";

// PUT /api/config/settings — upsert de chaves permitidas (whitelist do schema):
// fuel_price_eur_per_l, car_consumption_l_per_100km, active_car_scenario.
export async function PUT(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "json_invalido" }, { status: 400 });
  }
  const parsed = settingsPatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation", issues: parsed.error.issues }, { status: 400 });
  }
  const entries = Object.entries(parsed.data).filter(([, v]) => v != null);
  if (entries.length === 0) {
    return NextResponse.json({ error: "nada_para_atualizar" }, { status: 400 });
  }
  for (const [key, value] of entries) {
    await setSetting(key, String(value));
  }
  return NextResponse.json({ ok: true });
}
