-- =============================================================================
-- 007 · VIEWS  —  onde os campos [auto] ganham vida
-- =============================================================================
-- Regra de design aplicada: campo [auto] CALCULÁVEL a partir de routes/places/
-- settings/fórmula NÃO é coluna; é derivado aqui. Assim "trocar o sol" (apê)
-- recalcula tudo de graça, sem colunas defasadas.
-- Todas as views são CREATE OR REPLACE (idempotentes) e tolerantes a tabelas
-- vazias (LEFT JOIN + COALESCE), então funcionam mesmo antes de popular dados.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- v_apartment_costs  —  derivados de custo do próprio apê (bloco B)
--   rent_total   = aluguel "charges comprises" (HC soma charges; CC já inclui)
--   entry_cost   = 1º mês + taxa de agência + caução
--   effective    = rent_total − APL
-- -----------------------------------------------------------------------------
create or replace view v_apartment_costs as
select
  a.id as apartment_id,
  case when a.charges_type = 'HC'
       then coalesce(a.rent_base_eur,0) + coalesce(a.charges_eur,0)
       else coalesce(a.rent_base_eur,0)
  end as rent_total_eur,
  coalesce(a.first_month_eur,
           case when a.charges_type = 'HC'
                then coalesce(a.rent_base_eur,0) + coalesce(a.charges_eur,0)
                else coalesce(a.rent_base_eur,0) end)
    + coalesce(a.admin_fee_eur,0)
    + coalesce(a.deposit_eur,0) as entry_cost_eur,
  (case when a.charges_type = 'HC'
        then coalesce(a.rent_base_eur,0) + coalesce(a.charges_eur,0)
        else coalesce(a.rent_base_eur,0) end)
    - coalesce(a.apl_estimate_eur,0) as effective_cost_eur
from apartments a;

-- -----------------------------------------------------------------------------
-- v_apartment_nearest  —  o place MAIS PRÓXIMO de cada apê, por categoria.
-- Núcleo do modelo sol/planetas: 1 linha por (apartamento, categoria) = a rota de
-- menor duração até qualquer place daquela categoria (qualquer modo).
-- -----------------------------------------------------------------------------
create or replace view v_apartment_nearest as
select distinct on (r.apartment_id, p.category)
  r.apartment_id,
  p.category,
  p.id           as place_id,
  p.name         as place_name,
  r.mode,
  r.distance_m,
  r.duration_s,
  round(r.duration_s / 60.0)::int as duration_min,
  r.fuel_cost_eur
from routes r
join places p on p.id = r.place_id
order by r.apartment_id, p.category, r.duration_s asc;

-- -----------------------------------------------------------------------------
-- v_apartment_supermarket  —  supermercado DISCOUNT mais próximo por apê.
-- Usado no custo de comida (price_index multiplica o gasto mensal).
-- -----------------------------------------------------------------------------
create or replace view v_apartment_supermarket as
select distinct on (r.apartment_id)
  r.apartment_id,
  p.id                    as place_id,
  p.name                  as place_name,
  sd.is_discount,
  sd.price_index,
  round(r.duration_s / 60.0)::int as duration_min
from routes r
join places p on p.id = r.place_id and p.category = 'supermarket'
join supermarket_details sd on sd.place_id = p.id and sd.is_discount = true
order by r.apartment_id, r.duration_s asc;

-- -----------------------------------------------------------------------------
-- v_mobility_derived  —  campos [auto] de mobility_profile.
-- bus_stop/gare/gas_station são places (natureza 3): o "mais próximo" vem de routes.
-- A8 é um place travel_hub (hub_type='a8').
-- -----------------------------------------------------------------------------
create or replace view v_mobility_derived as
select
  a.id                    as apartment_id,
  bus.duration_min        as nearest_bus_stop_min,
  gare.duration_min       as nearest_gare_min,
  gare.place_name         as nearest_gare_name,
  gas.duration_min        as nearest_gas_station_min,
  a8.duration_min         as distance_a8_min
from apartments a
left join v_apartment_nearest bus  on bus.apartment_id  = a.id and bus.category  = 'bus_stop'
left join v_apartment_nearest gare on gare.apartment_id = a.id and gare.category = 'gare'
left join v_apartment_nearest gas  on gas.apartment_id  = a.id and gas.category  = 'gas_station'
left join lateral (
  select round(r.duration_s / 60.0)::int as duration_min
  from routes r
  join places p             on p.id = r.place_id
  join travel_hub_details t on t.place_id = p.id and t.hub_type = 'a8'
  where r.apartment_id = a.id
  order by r.duration_s asc
  limit 1
) a8 on true;

-- -----------------------------------------------------------------------------
-- v_study_access  —  campos [auto/router] de "estudar fora".
-- campus_library_min é aproximado pela rota até o campus (a biblioteca da SKEMA
-- fica no campus). nearest_library_min = biblioteca (place) mais próxima.
-- -----------------------------------------------------------------------------
create or replace view v_study_access as
select
  a.id                 as apartment_id,
  lib.duration_min     as nearest_library_min,
  camp.duration_min    as campus_library_min
from apartments a
left join v_apartment_nearest lib  on lib.apartment_id  = a.id and lib.category  = 'library'
left join v_apartment_nearest camp on camp.apartment_id = a.id and camp.category = 'campus';

-- -----------------------------------------------------------------------------
-- v_restaurant_meal_cost  —  custo de uma refeição por restaurante.
-- dish_price_eur manual vence; se nulo, cai num default por price_level (Google).
-- -----------------------------------------------------------------------------
create or replace view v_restaurant_meal_cost as
select
  rd.place_id,
  -- prato: valor manual OU default pelo price_level (1→12, 2→18, 3→30, 4→55 €)
  coalesce(rd.dish_price_eur,
           case rd.price_level when 1 then 12 when 2 then 18 when 3 then 30 when 4 then 55 else 18 end)
    + coalesce(rd.drink_eur,0)
    + coalesce(rd.dessert_eur,0)
    + coalesce(rd.tip_eur,0) as meal_cost_eur
from restaurant_details rd;

-- -----------------------------------------------------------------------------
-- v_car_cost  —  custo mensal fixo do carro, por cenário de car_config.
-- NÃO inclui combustível casa↔campus (esse é linha própria no custo de vida,
-- calculado de routes, p/ não contar em dobro). Para 'comprar', deprecia
-- (preço − revenda) / meses.
-- -----------------------------------------------------------------------------
create or replace view v_car_cost as
select
  c.id       as car_config_id,
  c.scenario,
  coalesce(c.monthly_eur,0)
    + case when c.scenario = 'comprar' and coalesce(c.months,0) > 0
           then (coalesce(c.purchase_price_eur,0) - coalesce(c.resale_estimate_eur,0)) / c.months
           else 0 end
    + coalesce(c.insurance_eur,0)
    + coalesce(c.tolls_eur,0)
    + coalesce(c.home_parking_eur,0)
    + coalesce(c.maintenance_eur,0) as car_total_month_eur
from car_config c;

-- -----------------------------------------------------------------------------
-- v_apartment_cost_of_living  —  CUSTO MENSAL TOTAL por apê.
-- Cada componente é uma coluna rastreável (de onde vem cada €; nada de número mágico):
--   rent_effective_eur  = aluguel CC − APL                       (do próprio apê)
--   food_eur            = food_profile × price_index do discount mais próximo
--   fuel_campus_eur     = combustível(rota carro→campus) × 2 × dias de campus/mês
--   car_fixed_eur       = custo fixo do carro do cenário ativo (settings.active_car_scenario)
--   ai_eur              = soma das assinaturas de IA
--   transit_eur         = passe de transporte público
-- Constantes: 4.33 = 52/12 (semanas por mês).
-- -----------------------------------------------------------------------------
create or replace view v_apartment_cost_of_living as
with cfg as (
  select
    (select coalesce(sum(monthly_eur),0) from ai_subscriptions)                        as ai_month_eur,
    (select coalesce(student_pass_eur,0) from transit_config order by created_at limit 1) as transit_month_eur,
    (select monthly_realistic_eur        from food_profile    order by created_at limit 1) as food_base_eur,
    (select v.car_total_month_eur
       from v_car_cost v
      where v.scenario = (select value::car_scenario from settings where key = 'active_car_scenario')
      limit 1)                                                                          as car_month_eur
),
components as (
  select
    a.id   as apartment_id,
    a.name as apartment_name,
    ac.effective_cost_eur                                              as rent_effective_eur,
    round(coalesce(cfg.food_base_eur,0) * coalesce(sm.price_index,1.00), 2) as food_eur,
    round(coalesce(camp.fuel_oneway,0) * 2 * days.per_month, 2)        as fuel_campus_eur,
    round(coalesce(cfg.car_month_eur,0), 2)                            as car_fixed_eur,
    round(coalesce(cfg.ai_month_eur,0), 2)                             as ai_eur,
    round(coalesce(cfg.transit_month_eur,0), 2)                        as transit_eur
  from apartments a
  cross join cfg
  join v_apartment_costs ac on ac.apartment_id = a.id
  left join v_apartment_supermarket sm on sm.apartment_id = a.id
  -- rota de carro até o campus (uma perna) → combustível de ida
  left join lateral (
    select r.fuel_cost_eur as fuel_oneway
    from routes r
    join places p on p.id = r.place_id and p.category = 'campus'
    where r.apartment_id = a.id and r.mode = 'driving'
    order by r.duration_s asc
    limit 1
  ) camp on true
  -- dias de campus por mês: dias distintos na grade × 4.33; se grade vazia, usa study_profile
  left join lateral (
    select coalesce(
             nullif((select count(distinct weekday) from class_schedule), 0),
             (select sp.campus_days_per_week from study_profile sp where sp.apartment_id = a.id),
             0
           ) * 4.33 as per_month
  ) days on true
)
select
  c.*,
  round(coalesce(c.rent_effective_eur,0)
      + c.food_eur
      + c.fuel_campus_eur
      + c.car_fixed_eur
      + c.ai_eur
      + c.transit_eur, 2) as total_month_eur
from components c;
