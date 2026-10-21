import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { gymDetailsSchema } from "@/lib/pillar-schemas";

// PATCH /api/places/[id]/gym — upsert dos detalhes editáveis de uma academia
// (mensalidade, qualidade). É o que dá custo ao pilar Academia. Zod no servidor.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "json_invalido" }, { status: 400 });
  }
  const parsed = gymDetailsSchema.safeParse(body);
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
    `insert into gym_details (place_id, ${cols}) values ($1, ${placeholders})
       on conflict (place_id) do update set ${updates}, updated_at = now()`,
    [id, ...values],
  );
  return NextResponse.json({ ok: true });
}
