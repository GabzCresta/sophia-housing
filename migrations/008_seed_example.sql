-- =============================================================================
-- 008 · Seed mínimo: configuração global + 1 apartamento de exemplo
-- =============================================================================
-- NÃO popula places/routes (isso é papel do coletor Google Maps, não deste schema).
-- Contém apenas:
--   1) as chaves de settings que a fórmula de custo de vida lê (config, não "dados");
--   2) UM apartamento comentado (Résidence Graziella) para testar as views.
-- Idempotente: ON CONFLICT DO NOTHING + UUID fixo no apê de exemplo.
-- =============================================================================

-- 1) Configuração global (a fórmula é rastreável: os números vivem aqui, não no código)
insert into settings (key, value) values
  ('fuel_price_eur_per_l',      '1.90'),   -- preço do litro (gasolina) — ajuste conforme a bomba
  ('car_consumption_l_per_100km','6.5'),   -- consumo médio do carro (L/100km)
  ('mass_availability_window',  'dom 08:00-12:00; qui 18:00-20:00'), -- janela em que consigo ir à missa
  ('active_car_scenario',       'sem_carro') -- qual cenário de car_config entra no custo de vida
on conflict (key) do nothing;

-- 2) Apartamento de exemplo — Résidence Graziella
--    19 Av. Maréchal Joffre, 06160 Antibes (Juan-les-Pins).
--    UUID fixo p/ permitir re-seed idempotente e referência estável nas 1:1.
insert into apartments (
  id, name, source_portal, listing_url, address, lat, lng, city, neighborhood, status,
  rent_base_eur, charges_eur, charges_type, first_month_eur, admin_fee_eur, deposit_eur, apl_estimate_eur,
  unit_type, separate_bedroom, area_m2, floor, furnished, condition,
  terrace, terrace_m2, view, exposure, air_conditioning, equipped_kitchen, dishwasher,
  washing_machine, bathroom, brightness_1_5, noise_1_5,
  elevator, security, parking, parking_cost_eur, amenities, building_condition,
  lease_type, available_from, available_to, guarantor, guarantor_min_income_eur,
  student_only, mandatory_insurance_eur,
  pros, cons, personal_notes
) values (
  '00000000-0000-0000-0000-0000000000a1',
  'Résidence Graziella',
  'exemplo',                              -- source_portal (troque pelo portal real)
  null,                                   -- listing_url
  '19 Av. Maréchal Joffre, 06160 Antibes',
  43.5766, 7.1143,                        -- lat/lng APROXIMADOS — TODO: confirmar via Google Maps API
  'Antibes', 'Juan-les-Pins',
  'candidatar',
  -- custo (valores ilustrativos; preencha com o anúncio real)
  850.00, 90.00, 'HC', 850.00, 300.00, 850.00, 180.00,
  -- unidade
  'T1', true, 32.00, 2, true, 'bom',
  false, null, 'jardim', 'S', true, true, false,
  true, 'chuveiro', 4, 2,
  -- prédio
  true, 'digicode', 'nenhum', null, '{jardim}', 'reformado',
  -- contrato
  'mobilite', date '2026-09-01', date '2027-07-31', 'visale', 2550.00,
  false, 12.00,
  -- avaliação
  'Perto do centro de Antibes e da gare; bairro tranquilo.',
  'Sem vaga de garagem; T1 pequeno.',
  'Exemplo para testar as views — substitua pelos apês reais.'
)
on conflict (id) do nothing;

-- Perfis 1:1 do apê de exemplo (parte descritiva/manual; o resto é view)
insert into mobility_profile (apartment_id, building_parking, envibus_lines, direct_bus_to_sophia)
values ('00000000-0000-0000-0000-0000000000a1', 'nenhum', '1, 100', false)
on conflict (apartment_id) do nothing;

insert into study_profile (
  apartment_id, desk_space, fiber_internet, fiber_speed, quiet_focus_1_5, natural_light_1_5,
  coworking_count_10min, campus_days_per_week, typical_class_hours, early_or_night,
  pros, cons, personal_notes
) values (
  '00000000-0000-0000-0000-0000000000a1', true, true, '500 Mbps', 4, 4,
  1, 3, '08:00-11:15 / 13:15-16:30', false,
  'Boa luz natural para estudar em casa.', 'Longe do campus de Sophia (depende de carro/ônibus).', null
)
on conflict (apartment_id) do nothing;

insert into apartment_area_stats (
  apartment_id, restaurants_10min_walk, bars_10min_walk, nightlife_dist_min, area_variety_1_5, zone_type
) values (
  '00000000-0000-0000-0000-0000000000a1', null, null, null, 4, 'centro_historico'
)
on conflict (apartment_id) do nothing;
