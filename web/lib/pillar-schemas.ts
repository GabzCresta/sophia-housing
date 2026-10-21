import { z } from "zod";

/**
 * Schemas dos pilares expansíveis (Fase 7) — seleção "esta é a minha" e detalhes
 * editáveis por lugar. Mesma validação cliente (RHF) e servidor.
 */

// Categorias onde faz sentido "escolher a minha opção".
export const SELECTABLE_CATEGORIES = [
  "gym",
  "supermarket",
  "restaurant",
  "church",
  "coworking",
  "hair_salon",
] as const;
export type SelectableCategory = (typeof SELECTABLE_CATEGORIES)[number];

/** Grava (ou limpa, com place_id=null) a opção escolhida do pilar para um apê. */
export const selectionSchema = z
  .object({
    category: z.enum(SELECTABLE_CATEGORIES),
    place_id: z.string().uuid().nullable(),
  })
  .strict();
export type SelectionInput = z.infer<typeof selectionSchema>;

/** Adicionar uma academia à mão. Com os dados do auto-search (lat/lng +
 *  apartment_id), a rota mede as distâncias na hora → gasolina calculável. */
export const gymAddSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    monthly_fee_eur: z.number().nonnegative().nullable().optional(),
    google_place_id: z.string().max(200).nullable().optional(),
    address: z.string().max(300).nullable().optional(),
    lat: z.number().min(-90).max(90).nullable().optional(),
    lng: z.number().min(-180).max(180).nullable().optional(),
    rating: z.number().min(0).max(5).nullable().optional(),
    apartment_id: z.string().uuid().nullable().optional(), // p/ medir as rotas já
  })
  .strict();
export type GymAddInput = z.infer<typeof gymAddSchema>;

/** Detalhes editáveis de uma academia (gym_details) — foco no que vira custo/decisão. */
export const gymDetailsSchema = z
  .object({
    monthly_fee_eur: z.number().nonnegative("não pode ser negativo").nullable(),
    quality_1_5: z.number().int().min(1).max(5).nullable(),
  })
  .partial()
  .strict();
export type GymDetailsInput = z.infer<typeof gymDetailsSchema>;

/** Detalhes editáveis de uma igreja (church_details) — revela campos órfãos. */
export const churchDetailsSchema = z
  .object({
    has_english_mass: z.boolean().nullable(),
    mass_times_sunday: z.string().max(200).nullable(),
  })
  .partial()
  .strict();
export type ChurchDetailsInput = z.infer<typeof churchDetailsSchema>;
