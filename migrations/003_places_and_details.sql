-- =============================================================================
-- 003 · places  +  tabelas de detalhe por categoria
-- =============================================================================
-- places = base compartilhada de TODOS os pontos geográficos (os "planetas").
-- Cada categoria com atributos próprios ganha uma tabela de detalhe 1:1
-- (place_id UNIQUE). Categorias sem atributos extras (bakery, bar, bus_stop,
-- gare, gas_station, coworking, library, campus) usam só a base places.
-- "O mais próximo" NUNCA é coluna: é query places(category) JOIN routes.
-- =============================================================================

create table if not exists places (
  id              uuid primary key default gen_random_uuid(),
  category        place_category not null,
  name            text not null,
  address         text,
  lat             numeric(9,6),
  lng             numeric(9,6),
  google_place_id text,                 -- id do Google Places (dedupe / refresh)
  rating          numeric(2,1),         -- nota do Google (0.0–5.0)
  is_manual       boolean not null default false,  -- true = cadastrado à mão; false = coletado pelo Claude/API

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_places_category  on places (category);
create unique index if not exists uq_places_google_place_id on places (google_place_id) where google_place_id is not null;
create index if not exists idx_places_geo        on places (lat, lng);

drop trigger if exists trg_places_updated_at on places;
create trigger trg_places_updated_at before update on places
  for each row execute function set_updated_at();

-- -----------------------------------------------------------------------------
-- supermarket_details (1:1)  —  SUPERMERCADO
-- price_index faz o custo de comida VARIAR por apê (via discount mais próximo).
-- -----------------------------------------------------------------------------
create table if not exists supermarket_details (
  id           uuid primary key default gen_random_uuid(),
  place_id     uuid not null unique references places(id) on delete cascade,
  chain        text,                    -- ex.: Lidl, Carrefour, Casino, Aldi
  market_type  market_type,
  is_discount  boolean not null default false,
  price_index  numeric(4,2) default 1.00, -- índice de preço da rede (1.00 = referência; 0.85 = mais barato)
  marche_nearby boolean,                -- há mercado/feira aberta por perto?
  marche_days  text,                    -- [manual] dias da feira (ex.: "ter, sex, dom")
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists trg_supermarket_details_updated_at on supermarket_details;
create trigger trg_supermarket_details_updated_at before update on supermarket_details
  for each row execute function set_updated_at();

-- -----------------------------------------------------------------------------
-- restaurant_details (1:1)  —  RESTAURANTES
-- custo_refeicao / custo_saida / custo_mensal são VIEW (não colunas).
-- dish_price_eur pode vir vazio: v_restaurant_meal_cost calcula um default a
-- partir do price_level, mas o valor manual sempre sobrescreve.
-- -----------------------------------------------------------------------------
create table if not exists restaurant_details (
  id              uuid primary key default gen_random_uuid(),
  place_id        uuid not null unique references places(id) on delete cascade,
  cuisine         cuisine_type,
  price_level     integer check (price_level between 1 and 4), -- vem do Google Places (€..€€€€)
  typical_dish    text,
  dish_price_eur  numeric(8,2),         -- default derivado do price_level (view), sobrescrevível
  drink_eur       numeric(8,2),
  dessert_eur     numeric(8,2),
  service_included boolean,
  tip_eur         numeric(8,2),
  frequency       restaurant_frequency,
  occasion        restaurant_occasion,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists trg_restaurant_details_updated_at on restaurant_details;
create trigger trg_restaurant_details_updated_at before update on restaurant_details
  for each row execute function set_updated_at();

-- -----------------------------------------------------------------------------
-- gym_details (1:1)  —  ACADEMIA
-- Estacionamento no destino + combustível ida/volta vêm de routes/view.
-- -----------------------------------------------------------------------------
create table if not exists gym_details (
  id              uuid primary key default gen_random_uuid(),
  place_id        uuid not null unique references places(id) on delete cascade,
  kind            gym_kind,
  plan_type       gym_plan_type,
  monthly_fee_eur numeric(8,2),
  signup_fee_eur  numeric(8,2),
  commitment      gym_commitment,
  cancel_fee_eur  numeric(8,2),
  weights         boolean,
  classes         boolean,
  has_pool        boolean,
  pool_size       pool_size,
  hours           text,
  quality_1_5     integer check (quality_1_5 between 1 and 5),
  usage_frequency gym_usage_frequency,
  fits_routine_1_5 integer check (fits_routine_1_5 between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists trg_gym_details_updated_at on gym_details;
create trigger trg_gym_details_updated_at before update on gym_details
  for each row execute function set_updated_at();

-- -----------------------------------------------------------------------------
-- church_details (1:1)  —  FÉ
-- "igreja mais próxima" e "mais próxima com missa em inglês" = query places+routes.
-- fits_my_schedule é [auto] (cruza mass_times com a janela em settings) → VIEW,
-- por isso NÃO existe como coluna aqui.
-- -----------------------------------------------------------------------------
create table if not exists church_details (
  id                   uuid primary key default gen_random_uuid(),
  place_id             uuid not null unique references places(id) on delete cascade,
  church_type          church_type,
  mass_times_week      text,             -- horários de missa em dias de semana
  mass_times_sunday    text,             -- horários de missa aos domingos
  confession_adoration text,             -- confissão / adoração
  language             text,             -- idioma principal das missas
  has_english_mass     boolean,          -- bônus: tem missa em inglês?
  youth_group          boolean,
  parish_activities    text,
  community_1_5        integer check (community_1_5 between 1 and 5),
  usage_frequency      church_usage_frequency,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists trg_church_details_updated_at on church_details;
create trigger trg_church_details_updated_at before update on church_details
  for each row execute function set_updated_at();

-- -----------------------------------------------------------------------------
-- travel_hub_details (1:1)  —  VIAGENS (natureza 2: ponto fixo, tempo varia por apê)
-- Destinos fixos (Cannes, Nice, Monaco, Saint-Tropez, Ventimiglia) e hubs
-- (aeroporto NCE, gare, A8) são places(category='travel_hub'); tempos por apê = routes.
-- -----------------------------------------------------------------------------
create table if not exists travel_hub_details (
  id                uuid primary key default gen_random_uuid(),
  place_id          uuid not null unique references places(id) on delete cascade,
  hub_type          travel_hub_type,      -- aeroporto | gare | a8 | destino
  easy_train_daytrip boolean,             -- dá pra bate-volta fácil de trem?
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists trg_travel_hub_details_updated_at on travel_hub_details;
create trigger trg_travel_hub_details_updated_at before update on travel_hub_details
  for each row execute function set_updated_at();
