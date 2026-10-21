import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import type { CarVsNoCar } from "@/lib/types";

// GET /api/car-vs-nocar/all — todos os apês (para o scatter comparativo tempo × dinheiro).
export async function GET() {
  const rows = await query<CarVsNoCar>(
    `select v.apartment_id, a.name as apartment_name,
            v.horas_mes_com_carro, v.horas_mes_sem_carro, v.horas_economizadas,
            v.custo_mes_com_carro, v.custo_mes_sem_carro, v.custo_extra_do_carro,
            v.eur_por_hora_economizada, v.hourly_value_eur
       from v_car_vs_nocar v
       join apartments a on a.id = v.apartment_id
      order by a.created_at`,
  );
  return NextResponse.json(rows);
}
