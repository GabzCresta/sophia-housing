-- =============================================================================
-- Housing Decision Platform · SCHEMA CONSOLIDADO (fonte da verdade)
-- =============================================================================
-- Snapshot completo do schema (enums + funções + tabelas + índices + triggers +
-- views), equivalente às migrations 001–007. NÃO inclui seed (ver migrations/008).
-- Idempotente e seguro de rodar do zero:  psql -f schema.sql
--
-- Modelo "sol/planetas": o apartamento (apartments) é o SOL; todos os pontos da
-- vida (places) são planetas; a distância/tempo/custo entre eles vive em routes.
-- Trocar de apê = ler outro apartment_id → tudo recalcula via views.
-- =============================================================================

create extension if not exists pgcrypto;

-- ── função de updated_at ─────────────────────────────────────────────────────
create or replace function set_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

-- ── ENUMs ────────────────────────────────────────────────────────────────────
do $$ begin create type apartment_status as enum ('favorito','candidatar','analisando','descartado'); exception when duplicate_object then null; end $$;
do $$ begin create type charges_type     as enum ('CC','HC');                                          exception when duplicate_object then null; end $$;
do $$ begin create type unit_type        as enum ('studio','T1','T2','T3');                             exception when duplicate_object then null; end $$;
do $$ begin create type condition_type   as enum ('novo','reformado','bom','a_renovar');               exception when duplicate_object then null; end $$;
do $$ begin create type view_type        as enum ('mar','jardim','rua','patio');                        exception when duplicate_object then null; end $$;
do $$ begin create type exposure_type    as enum ('N','S','L','O');                                     exception when duplicate_object then null; end $$;
do $$ begin create type bathroom_type    as enum ('banheira','chuveiro');                               exception when duplicate_object then null; end $$;
do $$ begin create type security_type    as enum ('guarda','digicode','interfone','cameras','nenhum');  exception when duplicate_object then null; end $$;
do $$ begin create type parking_type     as enum ('box_subsolo','rua','nenhum');                        exception when duplicate_object then null; end $$;
do $$ begin create type lease_type       as enum ('etudiant','mobilite','umano');                       exception when duplicate_object then null; end $$;
do $$ begin create type guarantor_type   as enum ('visale','studapart','pais','nenhum');               exception when duplicate_object then null; end $$;
do $$ begin create type place_category   as enum ('supermarket','bakery','restaurant','bar','gym','church','library','coworking','campus','travel_hub','bus_stop','gare','gas_station','hair_salon','shopping_mall','hospital','pharmacy','paki'); exception when duplicate_object then null; end $$;
do $$ begin create type market_type      as enum ('hipermercado','supermercado','mercearia','discount','congelados','bio'); exception when duplicate_object then null; end $$;
do $$ begin create type cuisine_type         as enum ('francesa','italiana','pizza','kebab','mediterranea','gastronomica','outro'); exception when duplicate_object then null; end $$;
do $$ begin create type restaurant_frequency as enum ('toda_semana','2x_mes','1x_mes','raro');          exception when duplicate_object then null; end $$;
do $$ begin create type restaurant_occasion  as enum ('dia_a_dia','date','amigos','especial');          exception when duplicate_object then null; end $$;
do $$ begin create type gym_kind             as enum ('academia','piscina','crossfit','studio','complexo'); exception when duplicate_object then null; end $$;
do $$ begin create type gym_plan_type        as enum ('mensal','trimestral','anual','student');         exception when duplicate_object then null; end $$;
do $$ begin create type gym_commitment       as enum ('sem','12_meses');                                 exception when duplicate_object then null; end $$;
do $$ begin create type pool_size            as enum ('25m','50m','lazer');                              exception when duplicate_object then null; end $$;
do $$ begin create type gym_usage_frequency  as enum ('diario','3_4x_sem','1_2x_sem');                   exception when duplicate_object then null; end $$;
do $$ begin create type church_type            as enum ('paroquia','capela','catedral','santuario');    exception when duplicate_object then null; end $$;
do $$ begin create type church_usage_frequency as enum ('diario','domingo','ocasional');                exception when duplicate_object then null; end $$;
do $$ begin create type travel_hub_type   as enum ('aeroporto','gare','a8','destino');                  exception when duplicate_object then null; end $$;
do $$ begin create type travel_profile    as enum ('batevolta_local','fds_regiao','viagens_maiores');   exception when duplicate_object then null; end $$;
do $$ begin create type travel_frequency  as enum ('todo_fds','2x_mes','mensal','raro');                exception when duplicate_object then null; end $$;
do $$ begin create type travel_companions as enum ('sozinho','namorada','amigos','familia');            exception when duplicate_object then null; end $$;
do $$ begin create type car_scenario      as enum ('aluguel_curto','leasing','comprar','sem_carro');    exception when duplicate_object then null; end $$;
do $$ begin create type food_buy_profile  as enum ('basico','cozinha_bastante','misto');                exception when duplicate_object then null; end $$;
do $$ begin create type route_mode        as enum ('driving','transit','walking');                      exception when duplicate_object then null; end $$;
do $$ begin create type zone_type         as enum ('praia_turistico','centro_historico','residencial','porto'); exception when duplicate_object then null; end $$;

-- ── apartments (o SOL) ───────────────────────────────────────────────────────
create table if not exists apartments (
  id uuid primary key default gen_random_uuid(),
  name text not null, source_portal text, listing_url text, photo_url text, address text,
  contact_info text, -- contato do anúncio (landlord/agência) — decisão à distância (009)
  lat numeric(9,6), lng numeric(9,6), city text, neighborhood text,
  status apartment_status not null default 'candidatar',
  rent_base_eur numeric(10,2), charges_eur numeric(10,2), charges_type charges_type,
  charges_include text[], -- o que as charges cobrem: agua, luz, aquecimento, internet (009)
  first_month_eur numeric(10,2), admin_fee_eur numeric(10,2), deposit_eur numeric(10,2), apl_estimate_eur numeric(10,2),
  unit_type unit_type, separate_bedroom boolean, area_m2 numeric(6,2), floor integer, furnished boolean, condition condition_type,
  terrace boolean, terrace_m2 numeric(6,2), view view_type, exposure exposure_type,
  air_conditioning boolean, equipped_kitchen boolean, dishwasher boolean, washing_machine boolean,
  bathroom bathroom_type,
  brightness_1_5 integer check (brightness_1_5 between 1 and 5),
  noise_1_5 integer check (noise_1_5 between 1 and 5),
  elevator boolean, security security_type, parking parking_type, parking_cost_eur numeric(10,2),
  amenities text[], building_condition text,
  lease_type lease_type, available_from date, available_to date, guarantor guarantor_type,
  guarantor_min_income_eur numeric(10,2), student_only boolean, mandatory_insurance_eur numeric(10,2),
  pros text, cons text, personal_notes text,
  -- true quando o endereço muda e as rotas (Google) ficam obsoletas até "Recalcular distâncias".
  routes_stale boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists idx_apartments_status       on apartments (status);
create index if not exists idx_apartments_city         on apartments (city);
create index if not exists idx_apartments_neighborhood on apartments (neighborhood);
create index if not exists idx_apartments_geo          on apartments (lat, lng);
drop trigger if exists trg_apartments_updated_at on apartments;
create trigger trg_apartments_updated_at before update on apartments for each row execute function set_updated_at();

-- ── places (os PLANETAS) + detalhes 1:1 por categoria ────────────────────────
create table if not exists places (
  id uuid primary key default gen_random_uuid(),
  category place_category not null, name text not null, address text,
  lat numeric(9,6), lng numeric(9,6), google_place_id text, rating numeric(2,1),
  is_manual boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists idx_places_category on places (category);
create unique index if not exists uq_places_google_place_id on places (google_place_id) where google_place_id is not null;
create index if not exists idx_places_geo on places (lat, lng);
drop trigger if exists trg_places_updated_at on places;
create trigger trg_places_updated_at before update on places for each row execute function set_updated_at();

create table if not exists supermarket_details (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null unique references places(id) on delete cascade,
  chain text, market_type market_type, is_discount boolean not null default false,
  price_index numeric(4,2) default 1.00, marche_nearby boolean, marche_days text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
drop trigger if exists trg_supermarket_details_updated_at on supermarket_details;
create trigger trg_supermarket_details_updated_at before update on supermarket_details for each row execute function set_updated_at();

create table if not exists restaurant_details (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null unique references places(id) on delete cascade,
  cuisine cuisine_type, price_level integer check (price_level between 1 and 4),
  typical_dish text, dish_price_eur numeric(8,2), drink_eur numeric(8,2), dessert_eur numeric(8,2),
  service_included boolean, tip_eur numeric(8,2), frequency restaurant_frequency, occasion restaurant_occasion,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
drop trigger if exists trg_restaurant_details_updated_at on restaurant_details;
create trigger trg_restaurant_details_updated_at before update on restaurant_details for each row execute function set_updated_at();

create table if not exists gym_details (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null unique references places(id) on delete cascade,
  kind gym_kind, plan_type gym_plan_type, monthly_fee_eur numeric(8,2), signup_fee_eur numeric(8,2),
  commitment gym_commitment, cancel_fee_eur numeric(8,2), weights boolean, classes boolean,
  has_pool boolean, pool_size pool_size, hours text,
  quality_1_5 integer check (quality_1_5 between 1 and 5),
  usage_frequency gym_usage_frequency,
  fits_routine_1_5 integer check (fits_routine_1_5 between 1 and 5),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
drop trigger if exists trg_gym_details_updated_at on gym_details;
create trigger trg_gym_details_updated_at before update on gym_details for each row execute function set_updated_at();

create table if not exists church_details (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null unique references places(id) on delete cascade,
  church_type church_type, mass_times_week text, mass_times_sunday text, confession_adoration text,
  language text, has_english_mass boolean, youth_group boolean, parish_activities text,
  community_1_5 integer check (community_1_5 between 1 and 5), usage_frequency church_usage_frequency,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
drop trigger if exists trg_church_details_updated_at on church_details;
create trigger trg_church_details_updated_at before update on church_details for each row execute function set_updated_at();

create table if not exists travel_hub_details (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null unique references places(id) on delete cascade,
  hub_type travel_hub_type, easy_train_daytrip boolean,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
drop trigger if exists trg_travel_hub_details_updated_at on travel_hub_details;
create trigger trg_travel_hub_details_updated_at before update on travel_hub_details for each row execute function set_updated_at();

-- ── routes (a GRAVIDADE: liga sol↔planetas com dados reais) ───────────────────
create table if not exists routes (
  id uuid primary key default gen_random_uuid(),
  apartment_id uuid not null references apartments(id) on delete cascade,
  place_id uuid not null references places(id) on delete cascade,
  mode route_mode not null, distance_m integer, duration_s integer,
  fuel_cost_eur numeric(8,2), computed_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint uq_routes_apartment_place_mode unique (apartment_id, place_id, mode)
);
create index if not exists idx_routes_apartment          on routes (apartment_id);
create index if not exists idx_routes_place              on routes (place_id);
create index if not exists idx_routes_apartment_duration on routes (apartment_id, duration_s);
drop trigger if exists trg_routes_updated_at on routes;
create trigger trg_routes_updated_at before update on routes for each row execute function set_updated_at();

-- ── perfis 1:1 do apê (descritivo/manual; o [auto] está nas views) ────────────
create table if not exists mobility_profile (
  id uuid primary key default gen_random_uuid(),
  apartment_id uuid not null unique references apartments(id) on delete cascade,
  building_parking parking_type, envibus_lines text, direct_bus_to_sophia boolean,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists idx_mobility_profile_apartment on mobility_profile (apartment_id);
drop trigger if exists trg_mobility_profile_updated_at on mobility_profile;
create trigger trg_mobility_profile_updated_at before update on mobility_profile for each row execute function set_updated_at();

create table if not exists study_profile (
  id uuid primary key default gen_random_uuid(),
  apartment_id uuid not null unique references apartments(id) on delete cascade,
  desk_space boolean, fiber_internet boolean, fiber_speed text,
  quiet_focus_1_5 integer check (quiet_focus_1_5 between 1 and 5),
  natural_light_1_5 integer check (natural_light_1_5 between 1 and 5),
  coworking_count_10min integer, campus_days_per_week integer, typical_class_hours text, early_or_night boolean,
  pros text, cons text, personal_notes text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists idx_study_profile_apartment on study_profile (apartment_id);
drop trigger if exists trg_study_profile_updated_at on study_profile;
create trigger trg_study_profile_updated_at before update on study_profile for each row execute function set_updated_at();

create table if not exists apartment_area_stats (
  id uuid primary key default gen_random_uuid(),
  apartment_id uuid not null unique references apartments(id) on delete cascade,
  restaurants_10min_walk integer, bars_10min_walk integer, nightlife_dist_min integer,
  area_variety_1_5 integer check (area_variety_1_5 between 1 and 5), zone_type zone_type,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists idx_area_stats_apartment on apartment_area_stats (apartment_id);
drop trigger if exists trg_area_stats_updated_at on apartment_area_stats;
create trigger trg_area_stats_updated_at before update on apartment_area_stats for each row execute function set_updated_at();

-- ── config de custo (natureza 1) + grade + settings ──────────────────────────
create table if not exists ai_subscriptions (
  id uuid primary key default gen_random_uuid(),
  name text not null, monthly_eur numeric(8,2) not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
drop trigger if exists trg_ai_subscriptions_updated_at on ai_subscriptions;
create trigger trg_ai_subscriptions_updated_at before update on ai_subscriptions for each row execute function set_updated_at();

create table if not exists car_config (
  id uuid primary key default gen_random_uuid(),
  scenario car_scenario not null, source text, model text, km_included integer,
  monthly_eur numeric(10,2), purchase_price_eur numeric(10,2), resale_estimate_eur numeric(10,2), months integer,
  insurance_eur numeric(10,2), insurance_deductible_eur numeric(10,2), fuel_month_eur numeric(10,2),
  tolls_eur numeric(10,2), home_parking_eur numeric(10,2), maintenance_eur numeric(10,2),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists idx_car_config_scenario on car_config (scenario);
drop trigger if exists trg_car_config_updated_at on car_config;
create trigger trg_car_config_updated_at before update on car_config for each row execute function set_updated_at();

create table if not exists transit_config (
  id uuid primary key default gen_random_uuid(), student_pass_eur numeric(8,2),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
drop trigger if exists trg_transit_config_updated_at on transit_config;
create trigger trg_transit_config_updated_at before update on transit_config for each row execute function set_updated_at();

create table if not exists food_profile (
  id uuid primary key default gen_random_uuid(),
  monthly_realistic_eur numeric(10,2), monthly_optimized_eur numeric(10,2), buy_profile food_buy_profile,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
drop trigger if exists trg_food_profile_updated_at on food_profile;
create trigger trg_food_profile_updated_at before update on food_profile for each row execute function set_updated_at();

create table if not exists travel_config (
  id uuid primary key default gen_random_uuid(),
  monthly_budget_eur numeric(10,2), profile travel_profile, frequency travel_frequency,
  companions travel_companions, typical_trip_fuel_toll_eur numeric(10,2), booked_flights_trains_eur numeric(10,2),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
drop trigger if exists trg_travel_config_updated_at on travel_config;
create trigger trg_travel_config_updated_at before update on travel_config for each row execute function set_updated_at();

create table if not exists class_schedule (
  id uuid primary key default gen_random_uuid(),
  course_name text, weekday integer check (weekday between 1 and 7),
  start_time time, end_time time, month text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists idx_class_schedule_weekday on class_schedule (weekday);
drop trigger if exists trg_class_schedule_updated_at on class_schedule;
create trigger trg_class_schedule_updated_at before update on class_schedule for each row execute function set_updated_at();

create table if not exists settings (
  key text primary key, value text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
drop trigger if exists trg_settings_updated_at on settings;
create trigger trg_settings_updated_at before update on settings for each row execute function set_updated_at();

-- "Esta é a minha" (Fase 7): a opção escolhida por apê+categoria (academia, mercado,
-- restaurante, igreja, coworking). Uma por (apê, categoria); alimenta custo/decisão.
create table if not exists apartment_selections (
  id uuid primary key default gen_random_uuid(),
  apartment_id uuid not null references apartments(id) on delete cascade,
  category place_category not null,
  place_id uuid not null references places(id) on delete cascade,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (apartment_id, category)
);

-- =============================================================================
-- VIEWS (campos [auto] derivados) — ver comentários detalhados em migrations/007
-- =============================================================================
create or replace view v_apartment_costs as
select
  a.id as apartment_id,
  case when a.charges_type='HC' then coalesce(a.rent_base_eur,0)+coalesce(a.charges_eur,0) else coalesce(a.rent_base_eur,0) end as rent_total_eur,
  coalesce(a.first_month_eur, case when a.charges_type='HC' then coalesce(a.rent_base_eur,0)+coalesce(a.charges_eur,0) else coalesce(a.rent_base_eur,0) end)
    + coalesce(a.admin_fee_eur,0) + coalesce(a.deposit_eur,0) as entry_cost_eur,
  (case when a.charges_type='HC' then coalesce(a.rent_base_eur,0)+coalesce(a.charges_eur,0) else coalesce(a.rent_base_eur,0) end)
    - coalesce(a.apl_estimate_eur,0) as effective_cost_eur
from apartments a;

create or replace view v_apartment_nearest as
select distinct on (r.apartment_id, p.category)
  r.apartment_id, p.category, p.id as place_id, p.name as place_name,
  r.mode, r.distance_m, r.duration_s, round(r.duration_s/60.0)::int as duration_min, r.fuel_cost_eur
from routes r join places p on p.id = r.place_id
order by r.apartment_id, p.category, r.duration_s asc;

create or replace view v_apartment_supermarket as
select distinct on (r.apartment_id)
  r.apartment_id, p.id as place_id, p.name as place_name, sd.is_discount, sd.price_index,
  round(r.duration_s/60.0)::int as duration_min
from routes r
join places p on p.id = r.place_id and p.category='supermarket'
join supermarket_details sd on sd.place_id = p.id and sd.is_discount = true
order by r.apartment_id, r.duration_s asc;

create or replace view v_mobility_derived as
select
  a.id as apartment_id,
  bus.duration_min as nearest_bus_stop_min,
  gare.duration_min as nearest_gare_min, gare.place_name as nearest_gare_name,
  gas.duration_min as nearest_gas_station_min, a8.duration_min as distance_a8_min
from apartments a
left join v_apartment_nearest bus  on bus.apartment_id  = a.id and bus.category  = 'bus_stop'
left join v_apartment_nearest gare on gare.apartment_id = a.id and gare.category = 'gare'
left join v_apartment_nearest gas  on gas.apartment_id  = a.id and gas.category  = 'gas_station'
left join lateral (
  select round(r.duration_s/60.0)::int as duration_min
  from routes r join places p on p.id = r.place_id
  join travel_hub_details t on t.place_id = p.id and t.hub_type='a8'
  where r.apartment_id = a.id order by r.duration_s asc limit 1
) a8 on true;

create or replace view v_study_access as
select a.id as apartment_id, lib.duration_min as nearest_library_min, camp.duration_min as campus_library_min
from apartments a
left join v_apartment_nearest lib  on lib.apartment_id  = a.id and lib.category  = 'library'
left join v_apartment_nearest camp on camp.apartment_id = a.id and camp.category = 'campus';

create or replace view v_restaurant_meal_cost as
select rd.place_id,
  coalesce(rd.dish_price_eur, case rd.price_level when 1 then 12 when 2 then 18 when 3 then 30 when 4 then 55 else 18 end)
    + coalesce(rd.drink_eur,0) + coalesce(rd.dessert_eur,0) + coalesce(rd.tip_eur,0) as meal_cost_eur
from restaurant_details rd;

create or replace view v_car_cost as
select c.id as car_config_id, c.scenario,
  coalesce(c.monthly_eur,0)
    + case when c.scenario='comprar' and coalesce(c.months,0)>0
           then (coalesce(c.purchase_price_eur,0)-coalesce(c.resale_estimate_eur,0))/c.months else 0 end
    + coalesce(c.insurance_eur,0) + coalesce(c.tolls_eur,0) + coalesce(c.home_parking_eur,0) + coalesce(c.maintenance_eur,0)
    as car_total_month_eur
from car_config c;

create or replace view v_apartment_cost_of_living as
with cfg as (
  select
    (select coalesce(sum(monthly_eur),0) from ai_subscriptions) as ai_month_eur,
    (select coalesce(student_pass_eur,0) from transit_config order by created_at desc limit 1) as transit_month_eur,
    -- food_mode (settings) decide qual valor entra no custo: 'otimizado' usa o otimizado, senão o realista.
    (select case when (select value from settings where key='food_mode') = 'otimizado'
                 then monthly_optimized_eur else monthly_realistic_eur end
       from food_profile order by created_at desc limit 1) as food_base_eur,
    coalesce((select value from settings where key='active_car_scenario'), 'sem_carro') as active_scenario,
    (select v.car_total_month_eur from v_car_cost v
       where v.scenario = (select value::car_scenario from settings where key='active_car_scenario') limit 1) as car_month_eur
),
components as (
  select a.id as apartment_id, a.name as apartment_name,
    ac.effective_cost_eur as rent_effective_eur,
    -- Fase 7: usa o price_index do mercado ESCOLHIDO ("esta é a minha"); senão do discount
    -- mais próximo (v_apartment_supermarket); senão 1.00.
    round(coalesce(cfg.food_base_eur,0)*coalesce(mysup.price_index, sm.price_index,1.00),2) as food_eur,
    -- Regra 1: combustível (casa↔campus) e passe são MUTUAMENTE EXCLUSIVOS por cenário.
    -- COM carro → só combustível; SEM carro → só passe. Nunca os dois pelo mesmo deslocamento.
    case when cfg.active_scenario = 'sem_carro' then 0
         else round(coalesce(camp.fuel_oneway,0)*2*days.per_month,2) end as fuel_campus_eur,
    round(coalesce(cfg.car_month_eur,0),2) as car_fixed_eur,
    round(coalesce(cfg.ai_month_eur,0),2) as ai_eur,
    case when cfg.active_scenario = 'sem_carro' then round(coalesce(cfg.transit_month_eur,0),2)
         else 0 end as transit_eur,
    -- Fase 7: mensalidade da academia escolhida ("esta é a minha") entra no custo.
    round(coalesce(gym.monthly_fee_eur,0),2) as gym_eur,
    (cfg.active_scenario <> 'sem_carro') as has_car
  from apartments a
  cross join cfg
  join v_apartment_costs ac on ac.apartment_id = a.id
  left join v_apartment_supermarket sm on sm.apartment_id = a.id
  left join lateral (
    select sd.price_index from apartment_selections s
    join supermarket_details sd on sd.place_id = s.place_id
    where s.apartment_id = a.id and s.category = 'supermarket' limit 1
  ) mysup on true
  left join lateral (
    select r.fuel_cost_eur as fuel_oneway from routes r
    join places p on p.id=r.place_id and p.category='campus'
    where r.apartment_id=a.id and r.mode='driving' order by r.duration_s asc limit 1
  ) camp on true
  left join lateral (
    select coalesce(nullif((select count(distinct weekday) from class_schedule),0),
                    (select sp.campus_days_per_week from study_profile sp where sp.apartment_id=a.id), 0) * 4.33 as per_month
  ) days on true
  left join lateral (
    select gd.monthly_fee_eur from apartment_selections s
    join gym_details gd on gd.place_id = s.place_id
    where s.apartment_id = a.id and s.category = 'gym' limit 1
  ) gym on true
)
select
  c.apartment_id, c.apartment_name, c.rent_effective_eur, c.food_eur, c.fuel_campus_eur,
  c.car_fixed_eur, c.ai_eur, c.transit_eur, c.gym_eur,
  round(coalesce(c.rent_effective_eur,0)+c.food_eur+c.fuel_campus_eur+c.car_fixed_eur+c.ai_eur+c.transit_eur+c.gym_eur,2) as total_month_eur,
  c.has_car
from components c;

-- Fase 8: "carro vale a pena?" — cruza TEMPO (trajeto campus, os 2 mundos) × DINHEIRO
-- (custo do carro no cenário ativo + combustível vs. passe). Reusa v_car_cost e class_schedule.
create or replace view v_car_vs_nocar as
with cfg as (
  select
    coalesce((select student_pass_eur from transit_config order by created_at desc limit 1),0) as passe,
    (select nullif(value,'')::numeric from settings where key='hourly_value_eur') as hourly_value,
    -- custo de TER carro: cenário ativo se for de carro; senão o cenário de carro salvo mais barato
    coalesce(
      (select v.car_total_month_eur from v_car_cost v
        where v.scenario = nullif((select value from settings where key='active_car_scenario'),'sem_carro')::car_scenario limit 1),
      (select min(v.car_total_month_eur) from v_car_cost v)
    ) as car_cost
),
per_apt as (
  select a.id as apartment_id,
    (select round(r.duration_s/60.0) from routes r join places p on p.id=r.place_id and p.category='campus'
      where r.apartment_id=a.id and r.mode='driving' order by r.duration_s limit 1) as drive_min,
    -- sem carro: transit; se não houver, walking
    coalesce(
      (select round(r.duration_s/60.0) from routes r join places p on p.id=r.place_id and p.category='campus'
        where r.apartment_id=a.id and r.mode='transit' order by r.duration_s limit 1),
      (select round(r.duration_s/60.0) from routes r join places p on p.id=r.place_id and p.category='campus'
        where r.apartment_id=a.id and r.mode='walking' order by r.duration_s limit 1)
    ) as nocar_min,
    (select r.fuel_cost_eur from routes r join places p on p.id=r.place_id and p.category='campus'
      where r.apartment_id=a.id and r.mode='driving' order by r.duration_s limit 1) as fuel_oneway,
    coalesce(nullif((select count(distinct weekday) from class_schedule),0),
             (select sp.campus_days_per_week from study_profile sp where sp.apartment_id=a.id), 0) * 4.33 as dias_mes
  from apartments a
)
select
  pa.apartment_id,
  round(coalesce(pa.drive_min,0)*2*pa.dias_mes/60.0, 1) as horas_mes_com_carro,
  round(coalesce(pa.nocar_min,0)*2*pa.dias_mes/60.0, 1) as horas_mes_sem_carro,
  round((coalesce(pa.nocar_min,0)-coalesce(pa.drive_min,0))*2*pa.dias_mes/60.0, 1) as horas_economizadas,
  round(cfg.car_cost + coalesce(pa.fuel_oneway,0)*2*pa.dias_mes, 2) as custo_mes_com_carro,
  round(cfg.passe, 2) as custo_mes_sem_carro,
  round(cfg.car_cost + coalesce(pa.fuel_oneway,0)*2*pa.dias_mes - cfg.passe, 2) as custo_extra_do_carro,
  case when (coalesce(pa.nocar_min,0)-coalesce(pa.drive_min,0))*2*pa.dias_mes > 0
       then round((cfg.car_cost + coalesce(pa.fuel_oneway,0)*2*pa.dias_mes - cfg.passe)
                  / ((coalesce(pa.nocar_min,0)-coalesce(pa.drive_min,0))*2*pa.dias_mes/60.0), 2)
       else null end as eur_por_hora_economizada,
  cfg.hourly_value as hourly_value_eur
from per_apt pa cross join cfg;
