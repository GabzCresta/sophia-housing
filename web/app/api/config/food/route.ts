import { NextResponse } from "next/server";
import { query, queryOne, setSetting } from "@/lib/db";
import { foodProfileSchema } from "@/lib/config-schemas";

// PUT /api/config/food — upsert do food_profile (linha única) + food_mode em settings.
// food_mode decide qual valor (realista/otimizado) a view usa no custo de vida.
export async function PUT(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "json_invalido" }, { status: 400 });
  }
  const parsed = foodProfileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation", issues: parsed.error.issues }, { status: 400 });
  }
  const { monthly_realistic_eur, monthly_optimized_eur, buy_profile, bulk_source, food_mode } = parsed.data;

  // Mantém linha única: atualiza a mais recente ou cria.
  const existing = await queryOne<{ id: string }>(
    `select id from food_profile order by created_at desc limit 1`,
  );
  if (existing) {
    await query(
      `update food_profile
          set monthly_realistic_eur = $1, monthly_optimized_eur = $2, buy_profile = $3, bulk_source = $4, updated_at = now()
        where id = $5`,
      [monthly_realistic_eur, monthly_optimized_eur, buy_profile, bulk_source, existing.id],
    );
  } else {
    await query(
      `insert into food_profile (monthly_realistic_eur, monthly_optimized_eur, buy_profile, bulk_source)
         values ($1, $2, $3, $4)`,
      [monthly_realistic_eur, monthly_optimized_eur, buy_profile, bulk_source],
    );
  }
  await setSetting("food_mode", food_mode);
  return NextResponse.json({ ok: true });
}
