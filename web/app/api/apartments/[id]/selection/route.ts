import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { selectionSchema } from "@/lib/pillar-schemas";

// PUT /api/apartments/[id]/selection — grava "esta é a minha" (uma por apê+categoria).
// place_id = null limpa a seleção. Zod valida no servidor.
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "json_invalido" }, { status: 400 });
  }
  const parsed = selectionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation", issues: parsed.error.issues }, { status: 400 });
  }
  const { category, place_id } = parsed.data;

  if (place_id === null) {
    await query(`delete from apartment_selections where apartment_id = $1 and category = $2`, [id, category]);
  } else {
    await query(
      `insert into apartment_selections (apartment_id, category, place_id) values ($1, $2, $3)
         on conflict (apartment_id, category) do update set place_id = excluded.place_id, updated_at = now()`,
      [id, category, place_id],
    );
  }
  return NextResponse.json({ ok: true });
}
