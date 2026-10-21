-- =============================================================================
-- 001 · Extensões, ENUMs e funções compartilhadas
-- =============================================================================
-- Base do schema: habilita gen_random_uuid(), cria todos os tipos ENUM e a
-- função de trigger de updated_at usada por todas as tabelas.
-- Idempotente: pode rodar mais de uma vez sem erro.
-- =============================================================================

-- gen_random_uuid() é nativo no PostgreSQL >= 13; pgcrypto garante compatibilidade
-- com versões anteriores e é inofensivo nas novas.
create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- Função de trigger: mantém updated_at sempre atualizado em qualquer UPDATE.
-- -----------------------------------------------------------------------------
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- -----------------------------------------------------------------------------
-- ENUMs. Cada um é criado dentro de um bloco que ignora "já existe" (idempotência).
-- -----------------------------------------------------------------------------

-- apartments -----------------------------------------------------------------
do $$ begin create type apartment_status as enum ('favorito','candidatar','visitando','descartado'); exception when duplicate_object then null; end $$;
do $$ begin create type charges_type     as enum ('CC','HC');                                         exception when duplicate_object then null; end $$; -- CC = charges comprises, HC = hors charges
do $$ begin create type unit_type        as enum ('studio','T1','T2','T3');                            exception when duplicate_object then null; end $$;
do $$ begin create type condition_type   as enum ('novo','reformado','bom','a_renovar');              exception when duplicate_object then null; end $$;
do $$ begin create type view_type        as enum ('mar','jardim','rua','patio');                       exception when duplicate_object then null; end $$;
do $$ begin create type exposure_type    as enum ('N','S','L','O');                                    exception when duplicate_object then null; end $$; -- Norte/Sul/Leste/Oeste
do $$ begin create type bathroom_type    as enum ('banheira','chuveiro');                              exception when duplicate_object then null; end $$;
do $$ begin create type security_type    as enum ('guarda','digicode','interfone','cameras','nenhum'); exception when duplicate_object then null; end $$;
do $$ begin create type parking_type     as enum ('box_subsolo','rua','nenhum');                       exception when duplicate_object then null; end $$;
do $$ begin create type lease_type       as enum ('etudiant','mobilite','umano');                      exception when duplicate_object then null; end $$;
do $$ begin create type guarantor_type   as enum ('visale','studapart','pais','nenhum');              exception when duplicate_object then null; end $$;

-- places (categoria compartilhada de TODOS os pontos geográficos) --------------
-- NOTA DE DESIGN: o spec listou 7 categorias como exemplo, mas o modelo conceitual
-- exige que "pontos de ônibus/gare" (natureza 3) e a busca por "posto mais próximo",
-- "padaria mais próxima" etc. funcionem via routes. Por isso a categoria foi estendida
-- para cobrir todos os pontos que precisam de rota. Ver README > Decisões.
do $$ begin create type place_category as enum (
  'supermarket','bakery','restaurant','bar','gym','church','library',
  'coworking','campus','travel_hub','bus_stop','gare','gas_station'
); exception when duplicate_object then null; end $$;

-- supermarket_details ---------------------------------------------------------
do $$ begin create type market_type as enum ('hipermercado','supermercado','mercearia','discount'); exception when duplicate_object then null; end $$;

-- restaurant_details ----------------------------------------------------------
do $$ begin create type cuisine_type          as enum ('francesa','italiana','pizza','kebab','mediterranea','gastronomica','outro'); exception when duplicate_object then null; end $$;
do $$ begin create type restaurant_frequency  as enum ('toda_semana','2x_mes','1x_mes','raro');       exception when duplicate_object then null; end $$;
do $$ begin create type restaurant_occasion   as enum ('dia_a_dia','date','amigos','especial');       exception when duplicate_object then null; end $$;

-- gym_details -----------------------------------------------------------------
do $$ begin create type gym_kind            as enum ('academia','piscina','crossfit','studio','complexo'); exception when duplicate_object then null; end $$;
do $$ begin create type gym_plan_type       as enum ('mensal','trimestral','anual','student');        exception when duplicate_object then null; end $$;
do $$ begin create type gym_commitment      as enum ('sem','12_meses');                                exception when duplicate_object then null; end $$;
do $$ begin create type pool_size           as enum ('25m','50m','lazer');                             exception when duplicate_object then null; end $$;
do $$ begin create type gym_usage_frequency as enum ('diario','3_4x_sem','1_2x_sem');                  exception when duplicate_object then null; end $$;

-- church_details --------------------------------------------------------------
do $$ begin create type church_type            as enum ('paroquia','capela','catedral','santuario');  exception when duplicate_object then null; end $$;
do $$ begin create type church_usage_frequency as enum ('diario','domingo','ocasional');              exception when duplicate_object then null; end $$;

-- travel_hub_details ----------------------------------------------------------
do $$ begin create type travel_hub_type as enum ('aeroporto','gare','a8','destino'); exception when duplicate_object then null; end $$;

-- travel_config ---------------------------------------------------------------
do $$ begin create type travel_profile    as enum ('batevolta_local','fds_regiao','viagens_maiores'); exception when duplicate_object then null; end $$;
do $$ begin create type travel_frequency  as enum ('todo_fds','2x_mes','mensal','raro');               exception when duplicate_object then null; end $$;
do $$ begin create type travel_companions as enum ('sozinho','namorada','amigos','familia');           exception when duplicate_object then null; end $$;

-- car_config ------------------------------------------------------------------
do $$ begin create type car_scenario as enum ('aluguel_curto','leasing','comprar','sem_carro'); exception when duplicate_object then null; end $$;

-- food_profile ----------------------------------------------------------------
do $$ begin create type food_buy_profile as enum ('basico','cozinha_bastante','misto'); exception when duplicate_object then null; end $$;

-- routes ----------------------------------------------------------------------
do $$ begin create type route_mode as enum ('driving','transit','walking'); exception when duplicate_object then null; end $$;

-- apartment_area_stats --------------------------------------------------------
do $$ begin create type zone_type as enum ('praia_turistico','centro_historico','residencial','porto'); exception when duplicate_object then null; end $$;
