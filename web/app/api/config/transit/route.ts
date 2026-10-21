import { NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { transitConfigSchema } from "@/lib/config-schemas";

// PUT /api/config/transit — upsert do passe estudante (linha única).
export async function PUT(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "json_invalido" }, { status: 400 });
  }
  const parsed = transitConfigSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation", issues: parsed.error.issues }, { status: 400 });
  }
  const existing = await queryOne<{ id: string }>(
    `select id from transit_config order by created_at desc limit 1`,
  );
  if (existing) {
    await query(`update transit_config set student_pass_eur = $1, updated_at = now() where id = $2`, [
      parsed.data.student_pass_eur,
      existing.id,
    ]);
  } else {
    await query(`insert into transit_config (student_pass_eur) values ($1)`, [
      parsed.data.student_pass_eur,
    ]);
  }
  return NextResponse.json({ ok: true });
}
