-- =============================================================================
-- 004 · routes  —  TABELA-CHAVE (faz o sol/planetas funcionar)
-- =============================================================================
-- Uma linha por (apartamento, lugar, modo de transporte). É o que liga o LAR aos
-- planetas com DADOS REAIS (Google Maps). Trocar de apê = ler outro apartment_id.
--
--   "X mais próximo do apê A"
--     = places(category = X) JOIN routes(apartment_id = A) ORDER BY duration_s LIMIT 1
--
-- distance_m / duration_s vêm da Directions API; fuel_cost_eur é pré-calculado
-- pelo app a partir de settings (preço do litro × consumo × km).
-- =============================================================================

create table if not exists routes (
  id            uuid primary key default gen_random_uuid(),
  apartment_id  uuid not null references apartments(id) on delete cascade,
  place_id      uuid not null references places(id)     on delete cascade,
  mode          route_mode not null,
  distance_m    integer,               -- metros
  duration_s    integer,               -- segundos (base de todo "mais próximo")
  fuel_cost_eur numeric(8,2),          -- custo de combustível da rota (só faz sentido p/ mode='driving')
  computed_at   timestamptz,           -- quando o router calculou (p/ saber se está velho)

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Uma rota por combinação apê × lugar × modo.
  constraint uq_routes_apartment_place_mode unique (apartment_id, place_id, mode)
);

-- Índices para as consultas de "mais próximo" e para navegação reversa.
create index if not exists idx_routes_apartment          on routes (apartment_id);
create index if not exists idx_routes_place              on routes (place_id);
create index if not exists idx_routes_apartment_duration on routes (apartment_id, duration_s);

drop trigger if exists trg_routes_updated_at on routes;
create trigger trg_routes_updated_at before update on routes
  for each row execute function set_updated_at();
