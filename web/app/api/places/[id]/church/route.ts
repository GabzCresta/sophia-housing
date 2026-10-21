import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { churchDetailsSchema } from "@/lib/pillar-schemas";

// PATCH /api/places/[id]/church — upsert dos detalhes editáveis de uma igreja
// (missa em inglês, horários de domingo). Revela campos órfãos de church_details.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "json_invalido" }, { status: 400 });
  }
  const parsed = churchDetailsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation", issues: parsed.error.issues }, { status: 400 });
  }
  const keys = Object.keys(parsed.data);
  if (keys.length === 0) return NextResponse.json({ error: "nada_para_atualizar" }, { status: 400 });

  const cols = keys.join(", ");
  const placeholders = keys.map((_, i) => `$${i + 2}`).join(", ");
  const updates = keys.map((k) => `${k} = excluded.${k}`).join(", ");
  const values = keys.map((k) => (parsed.data as Record<string, unknown>)[k]);

  await query(
    `insert into church_details (place_id, ${cols}) values ($1, ${placeholders})
       on conflict (place_id) do update set ${updates}, updated_at = now()`,
    [id, ...values],
  );
  return NextResponse.json({ ok: true });
}
