import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { apartmentPatchSchema } from "@/lib/schemas";

// PATCH /api/apartments/[id] — atualiza campos manuais do apê.
// Valida com Zod NO SERVIDOR (não confia só no cliente). As chaves vêm do schema
// (strict → rejeita colunas desconhecidas), então montar o SET dinâmico é seguro.
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "json_invalido" }, { status: 400 });
  }

  const parsed = apartmentPatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const keys = Object.keys(parsed.data);
  if (keys.length === 0) {
    return NextResponse.json({ error: "nada_para_atualizar" }, { status: 400 });
  }

  const sets = keys.map((k, i) => `${k} = $${i + 2}`).join(", ");
  const values = keys.map((k) => (parsed.data as Record<string, unknown>)[k]);

  // Mudar o endereço invalida as rotas (Google) — marca para "Recalcular distâncias".
  const staleClause = keys.includes("address") ? ", routes_stale = true" : "";

  const rows = await query<{ id: string }>(
    `update apartments set ${sets}${staleClause}, updated_at = now() where id = $1 returning id`,
    [id, ...values],
  );
  if (rows.length === 0) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}

// DELETE /api/apartments/[id] — apaga a residência; routes/perfis/seleções caem
// junto (FKs ON DELETE CASCADE, conferido no schema).
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const rows = await query<{ id: string }>(
    `delete from apartments where id = $1 returning id`,
    [id],
  );
  if (rows.length === 0) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
