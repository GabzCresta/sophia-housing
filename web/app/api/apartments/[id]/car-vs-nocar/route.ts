import { NextResponse } from "next/server";
import { queryOne } from "@/lib/db";
import type { CarVsNoCar } from "@/lib/types";

// GET /api/apartments/[id]/car-vs-nocar — tempo economizado × custo extra do carro, por apê.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const row = await queryOne<CarVsNoCar>(
    `select horas_mes_com_carro, horas_mes_sem_carro, horas_economizadas,
            custo_mes_com_carro, custo_mes_sem_carro, custo_extra_do_carro,
            eur_por_hora_economizada, hourly_value_eur
       from v_car_vs_nocar where apartment_id = $1`,
    [id],
  );
  if (!row) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json(row);
}
