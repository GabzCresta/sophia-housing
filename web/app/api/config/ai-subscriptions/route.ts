import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { aiSubscriptionSchema } from "@/lib/config-schemas";
import type { AiSubscription } from "@/lib/types";

// POST /api/config/ai-subscriptions — adiciona uma assinatura (nome + €/mês).
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "json_invalido" }, { status: 400 });
  }
  const parsed = aiSubscriptionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation", issues: parsed.error.issues }, { status: 400 });
  }
  const row = await query<AiSubscription>(
    `insert into ai_subscriptions (name, monthly_eur) values ($1, $2)
       returning id, name, monthly_eur`,
    [parsed.data.name, parsed.data.monthly_eur],
  );
  return NextResponse.json(row[0], { status: 201 });
}
