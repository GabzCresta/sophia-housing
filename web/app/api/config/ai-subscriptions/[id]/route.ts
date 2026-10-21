import { NextResponse } from "next/server";
import { query } from "@/lib/db";

// DELETE /api/config/ai-subscriptions/[id] — remove uma assinatura.
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const rows = await query<{ id: string }>(
    `delete from ai_subscriptions where id = $1 returning id`,
    [id],
  );
  if (rows.length === 0) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
