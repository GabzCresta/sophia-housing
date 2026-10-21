-- =============================================================================
-- 002 · apartments  —  O LAR (o "sol" do modelo)
-- =============================================================================
-- Cada linha é um apartamento candidato. É o centro de gravidade: ao trocar de
-- apê ("trocar o sol"), todas as distâncias/custos são recalculados a partir da
-- tabela routes. Campos de custo derivados (rent_total, entry_cost, effective_cost)
-- NÃO são colunas: vivem em v_apartment_costs (migration 007).
-- =============================================================================

create table if not exists apartments (
  id            uuid primary key default gen_random_uuid(),

  -- A · Identificação -----------------------------------------------------------
  name          text not null,
  source_portal text,                       -- ex.: SeLoger, LeBonCoin, PAP, Studapart
  listing_url   text,
  address       text,
  lat           numeric(9,6),               -- geolocalização do LAR (usada pelo router p/ montar routes)
  lng           numeric(9,6),
  city          text,
  neighborhood  text,
  status        apartment_status not null default 'candidatar',

  -- B · Custo (valores crus; derivados ficam em v_apartment_costs) --------------
  rent_base_eur         numeric(10,2),      -- aluguel base
  charges_eur           numeric(10,2),      -- condomínio/charges
  charges_type          charges_type,       -- CC (já incluso no base) | HC (soma ao base)
  first_month_eur       numeric(10,2),      -- valor do 1º mês (às vezes pró-rata)
  admin_fee_eur         numeric(10,2),      -- taxa de agência/dossiê
  deposit_eur           numeric(10,2),      -- caução (dépôt de garantie)
  apl_estimate_eur      numeric(10,2),      -- estimativa de auxílio-moradia (CAF/APL)

  -- C · A Unidade --------------------------------------------------------------
  unit_type         unit_type,
  separate_bedroom  boolean,                -- quarto separado da sala?
  area_m2           numeric(6,2),
  floor             integer,
  furnished         boolean,
  condition         condition_type,
  terrace           boolean,
  terrace_m2        numeric(6,2),
  view              view_type,
  exposure          exposure_type,
  air_conditioning  boolean,
  equipped_kitchen  boolean,
  dishwasher        boolean,
  washing_machine   boolean,
  bathroom          bathroom_type,
  brightness_1_5    integer check (brightness_1_5 between 1 and 5),
  noise_1_5         integer check (noise_1_5 between 1 and 5),

  -- D · Prédio -----------------------------------------------------------------
  elevator          boolean,
  security          security_type,
  parking           parking_type,           -- vaga que vem COM o apê
  parking_cost_eur  numeric(10,2),
  amenities         text[],                 -- {piscina, tenis, academia, jardim}
  building_condition text,

  -- E · Contrato ---------------------------------------------------------------
  lease_type              lease_type,
  available_from          date,
  available_to            date,
  guarantor               guarantor_type,
  guarantor_min_income_eur numeric(10,2),   -- renda mínima exigida do fiador
  student_only            boolean,
  mandatory_insurance_eur numeric(10,2),    -- seguro habitação obrigatório (assurance habitation)

  -- F · Avaliação [manual] -----------------------------------------------------
  pros            text,
  cons            text,
  personal_notes  text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Índices de busca comuns
create index if not exists idx_apartments_status       on apartments (status);
create index if not exists idx_apartments_city         on apartments (city);
create index if not exists idx_apartments_neighborhood on apartments (neighborhood);
create index if not exists idx_apartments_geo          on apartments (lat, lng);

-- Trigger de updated_at
drop trigger if exists trg_apartments_updated_at on apartments;
create trigger trg_apartments_updated_at before update on apartments
  for each row execute function set_updated_at();
