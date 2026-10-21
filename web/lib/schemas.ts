import { z } from "zod";

/**
 * Schemas Zod compartilhados entre cliente (React Hook Form) e servidor (rotas API).
 * A MESMA validação roda nos dois lados — não se confia só no cliente.
 */

export const APARTMENT_STATUS = ["favorito", "candidatar", "analisando", "descartado"] as const;

/** O que as charges podem cobrir (chips da ficha financeira). */
export const CHARGES_INCLUDE = ["agua", "luz", "aquecimento", "internet"] as const;

// Enums de apartments (espelham os types do banco) — para os selects editáveis da ficha do Lar.
export const UNIT_TYPES = ["studio", "T1", "T2", "T3"] as const;
export const VIEW_TYPES = ["mar", "jardim", "rua", "patio"] as const;
export const EXPOSURE_TYPES = ["N", "S", "L", "O"] as const;
export const CONDITION_TYPES = ["novo", "reformado", "bom", "a_renovar"] as const;
export const BATHROOM_TYPES = ["banheira", "chuveiro"] as const;
export const SECURITY_TYPES = ["guarda", "digicode", "interfone", "cameras", "nenhum"] as const;
export const PARKING_TYPES = ["box_subsolo", "rua", "nenhum"] as const;
export const LEASE_TYPES = ["etudiant", "mobilite", "umano"] as const;
export const GUARANTOR_TYPES = ["visale", "studapart", "pais", "nenhum"] as const;

const rating = z.number().int().min(1).max(5).nullable();
const money = z.number().nonnegative().nullable();
const bool = z.boolean().nullable();

const dateStr = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "data no formato AAAA-MM-DD")
  .nullable();

/** Campos do apê editáveis pela UI (parcial: envia-se só o que mudou). */
export const apartmentPatchSchema = z
  .object({
    status: z.enum(APARTMENT_STATUS),
    name: z.string().trim().min(1).max(120),
    city: z.string().max(120).nullable(),
    neighborhood: z.string().max(120).nullable(),
    charges_type: z.enum(["CC", "HC"]).nullable(),
    listing_url: z.string().max(2000).nullable(),
    available_from: dateStr,
    available_to: dateStr,
    amenities: z.array(z.string().max(40)).nullable(),
    brightness_1_5: rating,
    noise_1_5: rating,
    pros: z.string().max(4000).nullable(),
    cons: z.string().max(4000).nullable(),
    personal_notes: z.string().max(4000).nullable(),
    rent_base_eur: money,
    charges_eur: money,
    charges_include: z.array(z.enum(CHARGES_INCLUDE)).nullable(),
    contact_info: z.string().max(500).nullable(),
    first_month_eur: money,
    admin_fee_eur: money,
    deposit_eur: money,
    apl_estimate_eur: money,
    area_m2: z.number().positive().nullable(),
    address: z.string().min(3).max(300),
    // Ficha do Lar (Fase 7) — imóvel / prédio / contrato.
    unit_type: z.enum(UNIT_TYPES).nullable(),
    floor: z.number().int().nullable(),
    furnished: bool,
    separate_bedroom: bool,
    view: z.enum(VIEW_TYPES).nullable(),
    exposure: z.enum(EXPOSURE_TYPES).nullable(),
    condition: z.enum(CONDITION_TYPES).nullable(),
    terrace: bool,
    terrace_m2: money,
    bathroom: z.enum(BATHROOM_TYPES).nullable(),
    air_conditioning: bool,
    equipped_kitchen: bool,
    dishwasher: bool,
    washing_machine: bool,
    elevator: bool,
    security: z.enum(SECURITY_TYPES).nullable(),
    parking: z.enum(PARKING_TYPES).nullable(),
    parking_cost_eur: money,
    building_condition: z.string().max(200).nullable(),
    lease_type: z.enum(LEASE_TYPES).nullable(),
    guarantor: z.enum(GUARANTOR_TYPES).nullable(),
    guarantor_min_income_eur: money,
    student_only: bool,
    mandatory_insurance_eur: money,
    source_portal: z.string().max(200).nullable(),
    photo_url: z.string().max(2000).nullable(),
  })
  .partial()
  .strict();

export type ApartmentPatch = z.infer<typeof apartmentPatchSchema>;

/** Cadastro de uma residência pelo card do front: o endereço é o insumo de tudo
 *  (custos e distâncias nascem dele); apelido e aluguel são conveniências. */
export const apartmentCreateSchema = z
  .object({
    address: z.string().trim().min(5, "endereço muito curto").max(300),
    name: z.string().trim().min(1).max(120).optional(),
    rent_base_eur: z.number().nonnegative().nullable().optional(),
  })
  .strict();

export type ApartmentCreate = z.infer<typeof apartmentCreateSchema>;
