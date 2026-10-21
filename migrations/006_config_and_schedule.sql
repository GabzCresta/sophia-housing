-- =============================================================================
-- 006 · Configurações de custo (natureza 1: fixo absoluto) + grade + settings
-- =============================================================================
-- Estas tabelas NÃO dependem do apê (exceto food, cujo custo final é ajustado por
-- apê na view de custo de vida via price_index do discount mais próximo).
-- Config "singleton" (transit/food/travel) tem uuid PK por convenção, mas espera-se
-- 1 linha ativa. Onde há várias opções (car_config, ai_subscriptions), várias linhas.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- ai_subscriptions  —  IA (natureza 1, fixo) [manual]  ·  N linhas
-- -----------------------------------------------------------------------------
create table if not exists ai_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,             -- ex.: ChatGPT Plus, Claude Pro, Cursor
  monthly_eur numeric(8,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists trg_ai_subscriptions_updated_at on ai_subscriptions;
create trigger trg_ai_subscriptions_updated_at before update on ai_subscriptions
  for each row execute function set_updated_at();

-- -----------------------------------------------------------------------------
-- car_config  —  MOBILIDADE custo (natureza 1) [manual + pesquisa]  ·  N cenários
-- car_total_month é VIEW (v_car_cost). O cenário usado no custo de vida é o que
-- casa com settings.active_car_scenario. fuel_month_eur fica aqui como cache
-- opcional, mas o combustível casa↔campus é recalculado na view a partir de routes
-- (para não contar duas vezes, v_car_cost NÃO soma fuel_month_eur).
-- -----------------------------------------------------------------------------
create table if not exists car_config (
  id                     uuid primary key default gen_random_uuid(),
  scenario               car_scenario not null,
  source                 text,                 -- de onde veio a cotação
  model                  text,
  km_included            integer,
  monthly_eur            numeric(10,2),        -- mensalidade (aluguel/leasing)
  purchase_price_eur     numeric(10,2),        -- cenário 'comprar'
  resale_estimate_eur    numeric(10,2),        -- revenda estimada (p/ depreciação)
  months                 integer,              -- horizonte em meses (p/ depreciação)
  insurance_eur          numeric(10,2),
  insurance_deductible_eur numeric(10,2),
  fuel_month_eur         numeric(10,2),        -- [auto] cache; NÃO entra em v_car_cost
  tolls_eur              numeric(10,2),
  home_parking_eur       numeric(10,2),
  maintenance_eur        numeric(10,2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_car_config_scenario on car_config (scenario);
drop trigger if exists trg_car_config_updated_at on car_config;
create trigger trg_car_config_updated_at before update on car_config
  for each row execute function set_updated_at();

-- -----------------------------------------------------------------------------
-- transit_config  —  transporte público [manual]  ·  1 linha
-- -----------------------------------------------------------------------------
create table if not exists transit_config (
  id                uuid primary key default gen_random_uuid(),
  student_pass_eur  numeric(8,2),          -- passe estudante Envibus / Zou
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists trg_transit_config_updated_at on transit_config;
create trigger trg_transit_config_updated_at before update on transit_config
  for each row execute function set_updated_at();

-- -----------------------------------------------------------------------------
-- food_profile  —  SUPERMERCADO custo (natureza 1 base) [manual]  ·  1 linha
-- O custo real por apê = monthly_realistic_eur × price_index do discount mais próximo
-- (calculado em v_apartment_cost_of_living).
-- -----------------------------------------------------------------------------
create table if not exists food_profile (
  id                    uuid primary key default gen_random_uuid(),
  monthly_realistic_eur numeric(10,2),
  monthly_optimized_eur numeric(10,2),
  buy_profile           food_buy_profile,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists trg_food_profile_updated_at on food_profile;
create trigger trg_food_profile_updated_at before update on food_profile
  for each row execute function set_updated_at();

-- -----------------------------------------------------------------------------
-- travel_config  —  VIAGENS custo (natureza 1, orçamento) [manual]  ·  1 linha
-- NÃO entra em pontuação de escolha do apê; é orçamento à parte.
-- typical_trip_fuel_toll_eur é [auto] (derivável de routes p/ destinos), mas mantido
-- como coluna manual/cache porque depende do destino escolhido em cada viagem.
-- -----------------------------------------------------------------------------
create table if not exists travel_config (
  id                        uuid primary key default gen_random_uuid(),
  monthly_budget_eur        numeric(10,2),
  profile                   travel_profile,
  frequency                 travel_frequency,
  companions                travel_companions,
  typical_trip_fuel_toll_eur numeric(10,2),
  booked_flights_trains_eur numeric(10,2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists trg_travel_config_updated_at on travel_config;
create trigger trg_travel_config_updated_at before update on travel_config
  for each row execute function set_updated_at();

-- -----------------------------------------------------------------------------
-- class_schedule  —  grade de aulas (alimenta dias de campus/mês) [manual/import]
-- weekday: 1=segunda ... 7=domingo (ISO). Ex.: seg/qua/qui, blocos 08:00–11:15 e 13:15–16:30.
-- -----------------------------------------------------------------------------
create table if not exists class_schedule (
  id          uuid primary key default gen_random_uuid(),
  course_name text,
  weekday     integer check (weekday between 1 and 7),
  start_time  time,
  end_time    time,
  month       text,                       -- ex.: "2026-09" ou "setembro"
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_class_schedule_weekday on class_schedule (weekday);
drop trigger if exists trg_class_schedule_updated_at on class_schedule;
create trigger trg_class_schedule_updated_at before update on class_schedule
  for each row execute function set_updated_at();

-- -----------------------------------------------------------------------------
-- settings  —  globais chave/valor
-- Ex.: fuel_price_eur_per_l, car_consumption_l_per_100km, mass_availability_window,
--      active_car_scenario (qual cenário de car_config entra no custo de vida).
-- -----------------------------------------------------------------------------
create table if not exists settings (
  key        text primary key,
  value      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists trg_settings_updated_at on settings;
create trigger trg_settings_updated_at before update on settings
  for each row execute function set_updated_at();
