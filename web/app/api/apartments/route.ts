import { NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { apartmentCreateSchema } from "@/lib/schemas";
import type { ApartmentListItem } from "@/lib/types";

// GET /api/apartments — lista os apês com custo total (das views), para o seletor e a comparação.
export async function GET() {
  const rows = await query<ApartmentListItem>(
    `select a.id, a.name, a.city, a.neighborhood, a.status, a.unit_type, a.area_m2,
            c.rent_total_eur, c.effective_cost_eur, col.total_month_eur,
            (select duration_min from v_apartment_nearest n where n.apartment_id = a.id and n.category = 'campus')      as campus_min,
            (select duration_min from v_apartment_nearest n where n.apartment_id = a.id and n.category = 'supermarket') as supermarket_min,
            (select duration_min from v_apartment_nearest n where n.apartment_id = a.id and n.category = 'church')      as church_min,
            (select duration_min from v_apartment_nearest n where n.apartment_id = a.id and n.category = 'gym')         as gym_min
       from apartments a
       left join v_apartment_costs c            on c.apartment_id = a.id
       left join v_apartment_cost_of_living col on col.apartment_id = a.id
      order by a.created_at`,
  );
  return NextResponse.json(rows);
}

// POST /api/apartments — cadastra uma residência a partir do endereço (card do front).
// Não calcula nada: rotas/custos vêm depois (routes_stale=true marca o pendente).
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "json_invalido" }, { status: 400 });
  }

  const parsed = apartmentCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { address, name, rent_base_eur } = parsed.data;

  // Mesmo endereço já cadastrado → devolve o existente em vez de duplicar o sol.
  const dup = await queryOne<{ id: string; name: string }>(
    `select id, name from apartments where lower(trim(address)) = lower(trim($1))`,
    [address],
  );
  if (dup) {
    return NextResponse.json({ error: "endereco_ja_existe", apartment: dup }, { status: 409 });
  }

  const row = await queryOne<{ id: string; name: string; address: string; status: string }>(
    `insert into apartments (name, address, rent_base_eur, routes_stale)
     values ($1, $2, $3, true)
     returning id, name, address, status`,
    // Sem apelido, o nome é o primeiro trecho do endereço (até a vírgula).
    [name ?? address.split(",")[0].trim(), address, rent_base_eur ?? null],
  );
  return NextResponse.json(row, { status: 201 });
}
