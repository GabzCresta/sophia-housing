import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { carPatchSchema } from "@/lib/config-schemas";

// PATCH /api/config/car/[id] — edita campos de um carro salvo (parcial).
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "json_invalido" }, { status: 400 });
  }
  const parsed = carPatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation", issues: parsed.error.issues }, { status: 400 });
  }
  const keys = Object.keys(parsed.data);
  if (keys.length === 0) return NextResponse.json({ error: "nada_para_atualizar" }, { status: 400 });
  const sets = keys.map((k, i) => `${k} = $${i + 2}`).join(", ");
  const values = keys.map((k) => (parsed.data as Record<string, unknown>)[k]);
  const rows = await query<{ id: string }>(
    `update car_config set ${sets}, updated_at = now() where id = $1 returning id`,
    [id, ...values],
  );
  if (rows.length === 0) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

// DELETE /api/config/car/[id] — remove um cenário de carro salvo.
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const rows = await query<{ id: string }>(`delete from car_config where id = $1 returning id`, [id]);
  if (rows.length === 0) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
