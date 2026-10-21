import { NextResponse } from "next/server";
import { queryOne } from "@/lib/db";
import type { ApartmentFull } from "@/lib/types";

// GET /api/apartments/[id]/full — a ficha completa da Moradia (grupos A-F):
// identificação, custo (com os [auto] da view v_apartment_costs), unidade,
// prédio, contrato e avaliação. Lat/lng ficam de fora (insumo interno do router).
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const row = await queryOne<ApartmentFull>(
    `select a.id, a.name, a.status, a.city, a.neighborhood, a.address,
            a.source_portal, a.listing_url, a.photo_url, a.contact_info,
            a.rent_base_eur, a.charges_eur, a.charges_type, a.charges_include,
            a.first_month_eur, a.admin_fee_eur, a.deposit_eur, a.apl_estimate_eur, a.mandatory_insurance_eur,
            a.unit_type, a.area_m2, a.floor, a.furnished, a.separate_bedroom, a.view, a.exposure, a.condition,
            a.terrace, a.terrace_m2, a.bathroom, a.air_conditioning, a.equipped_kitchen, a.dishwasher, a.washing_machine,
            a.brightness_1_5, a.noise_1_5,
            a.elevator, a.security, a.parking, a.parking_cost_eur, a.building_condition, a.amenities,
            a.lease_type, a.available_from, a.available_to, a.guarantor, a.guarantor_min_income_eur, a.student_only,
            a.pros, a.cons, a.personal_notes, a.routes_stale,
            c.rent_total_eur, c.entry_cost_eur, c.effective_cost_eur
       from apartments a
       left join v_apartment_costs c on c.apartment_id = a.id
      where a.id = $1`,
    [id],
  );
  if (!row) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json(row);
}
