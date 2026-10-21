-- =============================================================================
-- 005 · Perfis 1:1 do apartamento (Mobilidade, Estudos, Estatísticas de vizinhança)
-- =============================================================================
-- Estas tabelas guardam SÓ o que é descritivo/manual e NÃO é rota. Tudo que é
-- [auto] e calculável a partir de routes+places+settings vira VIEW (migration 007),
-- não coluna — para não duplicar o que já vive em routes.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- mobility_profile (1:1)  —  MOBILIDADE (parte descritiva, não-rota)
-- Derivados em VIEW v_mobility_derived: distance_a8_min, nearest_gas_station_min,
-- nearest_bus_stop_min, nearest_gare_min, nearest_gare_name.
-- -----------------------------------------------------------------------------
create table if not exists mobility_profile (
  id                  uuid primary key default gen_random_uuid(),
  apartment_id        uuid not null unique references apartments(id) on delete cascade,
  building_parking    parking_type,          -- infraestrutura de carro do prédio
  envibus_lines       text,                  -- linhas Envibus que servem o ponto (ex.: "1, 100, 230")
  direct_bus_to_sophia boolean,              -- há ônibus direto até Sophia Antipolis?
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_mobility_profile_apartment on mobility_profile (apartment_id);
drop trigger if exists trg_mobility_profile_updated_at on mobility_profile;
create trigger trg_mobility_profile_updated_at before update on mobility_profile
  for each row execute function set_updated_at();

-- -----------------------------------------------------------------------------
-- study_profile (1:1)  —  ESTUDOS
-- Acesso ao campus e "estudar fora" derivados em v_study_access (nearest_library_min,
-- campus_library_min). coworking_count_10min fica como coluna [manual]: coworking
-- pode não estar mapeado como place em toda zona, então não é sempre calculável.
-- -----------------------------------------------------------------------------
create table if not exists study_profile (
  id                  uuid primary key default gen_random_uuid(),
  apartment_id        uuid not null unique references apartments(id) on delete cascade,

  -- C · estudar em casa [manual; fiber pode vir do anúncio] --------------------
  desk_space          boolean,
  fiber_internet      boolean,
  fiber_speed         text,
  quiet_focus_1_5     integer check (quiet_focus_1_5 between 1 and 5),
  natural_light_1_5   integer check (natural_light_1_5 between 1 and 5),

  -- D · estudar fora ----------------------------------------------------------
  coworking_count_10min integer,            -- [manual] coworkings a ~10min (coworking nem sempre mapeado como place)

  -- E · rotina (resumo alimentado por class_schedule) -------------------------
  campus_days_per_week integer,             -- fallback quando class_schedule está vazio
  typical_class_hours  text,                -- ex.: "08:00–11:15 / 13:15–16:30"
  early_or_night       boolean,             -- aulas cedo ou à noite?

  pros            text,
  cons            text,
  personal_notes  text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_study_profile_apartment on study_profile (apartment_id);
drop trigger if exists trg_study_profile_updated_at on study_profile;
create trigger trg_study_profile_updated_at before update on study_profile
  for each row execute function set_updated_at();

-- -----------------------------------------------------------------------------
-- apartment_area_stats (1:1)  —  estatísticas de vizinhança por apê
-- Contagens agregadas (não rotas individuais). O app pode preencher as [auto]
-- via router; bars/nightlife não são derivadas de places, então ficam como cache.
-- -----------------------------------------------------------------------------
create table if not exists apartment_area_stats (
  id                   uuid primary key default gen_random_uuid(),
  apartment_id         uuid not null unique references apartments(id) on delete cascade,
  restaurants_10min_walk integer,           -- [auto/router] nº de restaurantes a ~10min a pé
  bars_10min_walk      integer,             -- [auto/router]
  nightlife_dist_min   integer,             -- [auto/router] distância à vida noturna
  area_variety_1_5     integer check (area_variety_1_5 between 1 and 5),  -- [manual]
  zone_type            zone_type,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_area_stats_apartment on apartment_area_stats (apartment_id);
drop trigger if exists trg_area_stats_updated_at on apartment_area_stats;
create trigger trg_area_stats_updated_at before update on apartment_area_stats
  for each row execute function set_updated_at();
