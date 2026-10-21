import { z } from "zod";

/**
 * Schemas Zod dos formulários de config (Fase 6, passo 3) — MESMA validação no
 * cliente (RHF) e no servidor (rotas /api/config/*). Preenchem as tabelas vazias
 * que hoje deixam o budget em €0,00.
 */

export const CAR_SCENARIOS = ["aluguel_curto", "leasing", "comprar", "sem_carro"] as const;
export const FOOD_BUY_PROFILES = ["basico", "cozinha_bastante", "misto"] as const;
export const FOOD_MODES = ["realista", "otimizado"] as const;
export const FOOD_BULK_SOURCES = ["discount", "medio", "caro"] as const;

export type CarScenario = (typeof CAR_SCENARIOS)[number];
export type FoodMode = (typeof FOOD_MODES)[number];

// Tipos limpos (sem preprocess, para o zodResolver do RHF casar input=output).
// A conversão "" / vazio → null é feita no cliente via setValueAs (ver config-panel);
// o servidor recebe number|null direto do JSON.
const money = z.number({ message: "informe um valor" }).nonnegative("não pode ser negativo");
const moneyOpt = z.number().nonnegative("não pode ser negativo").nullable();
const intOpt = z.number().int().nonnegative().nullable();
const posOpt = z.number().positive().nullable();

/** IA — uma assinatura (nome + €/mês). A lista soma no budget (linha IA). */
export const aiSubscriptionSchema = z
  .object({ name: z.string().min(1, "informe o nome").max(80), monthly_eur: money })
  .strict();
export type AiSubscriptionInput = z.infer<typeof aiSubscriptionSchema>;

/** Comida — valores realista/otimizado + perfil + qual modo entra no custo. */
export const foodProfileSchema = z
  .object({
    monthly_realistic_eur: moneyOpt,
    monthly_optimized_eur: moneyOpt,
    buy_profile: z.enum(FOOD_BUY_PROFILES).nullable(),
    bulk_source: z.enum(FOOD_BULK_SOURCES).nullable(), // onde compra o grosso (010)
    food_mode: z.enum(FOOD_MODES),
  })
  .strict();
export type FoodProfileInput = z.infer<typeof foodProfileSchema>;

/** Transporte — passe estudante (Envibus/Zou). */
export const transitConfigSchema = z.object({ student_pass_eur: moneyOpt }).strict();
export type TransitConfigInput = z.infer<typeof transitConfigSchema>;

/** Carro — um cenário salvo. Upsert por `scenario` (1 config por tipo). */
export const carConfigSchema = z
  .object({
    scenario: z.enum(CAR_SCENARIOS),
    source: z.string().max(200).nullable().optional(), // site/fonte (cargo-flex, Sixt…)
    model: z.string().max(120).nullable().optional(),
    km_included: intOpt.optional(),
    monthly_eur: moneyOpt.optional(),
    purchase_price_eur: moneyOpt.optional(),
    resale_estimate_eur: moneyOpt.optional(),
    months: posOpt.optional(),
    insurance_eur: moneyOpt.optional(),
    insurance_deductible_eur: moneyOpt.optional(), // franquia do seguro
    tolls_eur: moneyOpt.optional(),
    home_parking_eur: moneyOpt.optional(),
    maintenance_eur: moneyOpt.optional(),
  })
  .strict();
export type CarConfigInput = z.infer<typeof carConfigSchema>;

/** Edição inline de um carro salvo (parcial — envia-se só o que mudou). */
export const carPatchSchema = carConfigSchema.partial().strict();
export type CarPatchInput = z.infer<typeof carPatchSchema>;

/** Settings gerais editáveis pelo painel + o cenário de carro ativo.
 *  Parcial: envia-se só o que mudou. Whitelist estrita (evita escrever chave arbitrária). */
export const settingsPatchSchema = z
  .object({
    fuel_price_eur_per_l: posOpt,
    car_consumption_l_per_100km: posOpt,
    active_car_scenario: z.enum(CAR_SCENARIOS),
    hourly_value_eur: posOpt, // "quanto vale sua hora" (Fase 8) — opcional
    supermarket_budget_eur: posOpt, // budget que EU estipulo p/ mercado (seção Supermercado)
    restaurant_budget_eur: posOpt, // budget que EU estipulo p/ restaurantes (seção Restaurante)
    transit_plan: z.string().max(60).nullable(), // plano de transporte escolhido (seção Transporte)
    active_car_id: z.string().uuid().nullable(), // o carro escolhido na seção Carro
    supermarket_trips_per_month: posOpt, // idas ao mercado /mês (cálculo da gasolina)
    gym_trips_per_month: posOpt, // treinos /mês (gasolina até a academia)
    church_trips_per_month: posOpt, // missas /mês (gasolina até a igreja)
    travel_budget_eur: posOpt, // budget de viagens (seção Viajar — só isso, a pedido dele)
    hair_budget_eur: posOpt, // budget de cabeleireiro
    shopping_budget_eur: posOpt, // budget de shopping/compras
    health_budget_eur: posOpt, // budget de saúde (seção Médico)
  })
  .partial()
  .strict();
export type SettingsPatchInput = z.infer<typeof settingsPatchSchema>;
