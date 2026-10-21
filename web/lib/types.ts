// Tipos compartilhados entre as rotas de API e o front.
// Refletem as colunas/valores das VIEWS do banco (custo, nearest, etc.).

// Sem "visitando": a decisão é à distância (Brasil) — o estágio de coleta de
// informação (fotos, landlord, reviews) é "analisando".
export type ApartmentStatus = "favorito" | "candidatar" | "analisando" | "descartado";

/** Item da lista de apês (GET /api/apartments) — inclui tempos por pilar p/ comparação. */
export interface ApartmentListItem {
  id: string;
  name: string;
  city: string | null;
  neighborhood: string | null;
  status: ApartmentStatus;
  unit_type: string | null;
  area_m2: number | null;
  rent_total_eur: number | null;
  effective_cost_eur: number | null;
  total_month_eur: number | null;
  campus_min: number | null;
  supermarket_min: number | null;
  church_min: number | null;
  gym_min: number | null;
}

/** Quebra do custo de vida (v_apartment_cost_of_living). */
export interface CostOfLiving {
  rent_effective_eur: number | null;
  food_eur: number | null;
  fuel_campus_eur: number | null;
  car_fixed_eur: number | null;
  ai_eur: number | null;
  transit_eur: number | null;
  gym_eur: number | null; // mensalidade da academia escolhida ("esta é a minha")
  total_month_eur: number | null;
  // Regra 1: com carro → combustível ativo (passe zero); sem carro → passe ativo (combustível zero).
  has_car: boolean;
}

/** Uma academia no pilar expansível (GET /api/apartments/[id]/pillar/gym). */
export interface GymOption {
  id: string; // place_id
  name: string;
  rating: number | null; // nota do Google
  walkMin: number | null;
  driveMin: number | null;
  driveM: number | null; // distância de carro em metros (gasolina)
  selected: boolean; // é "a minha"?
  monthly_fee_eur: number | null; // gym_details (editável)
  quality_1_5: number | null; // gym_details (editável)
}

/** Um lugar num pilar geográfico expansível (GET /api/apartments/[id]/pillar/[category]).
 *  Campos de detalhe vêm preenchidos conforme a categoria. */
export interface PlaceOption {
  id: string;
  name: string;
  rating: number | null;
  walkMin: number | null;
  driveMin: number | null;
  driveM: number | null; // distância de carro em metros (cálculo de gasolina)
  google_place_id?: string | null; // p/ link "ver no Google"
  selected: boolean;
  // supermarket
  is_discount?: boolean | null;
  price_index?: number | null;
  chain?: string | null;
  market_type?: string | null;
  // restaurant
  meal_cost_eur?: number | null;
  cuisine?: string | null;
  price_level?: number | null;
  // church
  has_english_mass?: boolean | null;
  mass_times_sunday?: string | null;
  language?: string | null;
}

/** Ficha completa da Moradia (GET /api/apartments/[id]/full) — grupos A-F. */
export interface ApartmentFull {
  id: string;
  // A. identificação
  name: string;
  status: ApartmentStatus;
  city: string | null;
  neighborhood: string | null;
  address: string | null;
  // B. custo
  rent_base_eur: number | null;
  charges_eur: number | null;
  charges_type: string | null;
  charges_include: string[] | null; // o que as charges cobrem: agua, luz, aquecimento, internet
  first_month_eur: number | null;
  admin_fee_eur: number | null;
  deposit_eur: number | null;
  apl_estimate_eur: number | null;
  mandatory_insurance_eur: number | null;
  // [auto] — v_apartment_costs
  rent_total_eur: number | null;
  entry_cost_eur: number | null;
  effective_cost_eur: number | null;
  // imóvel
  unit_type: string | null;
  area_m2: number | null;
  floor: number | null;
  furnished: boolean | null;
  separate_bedroom: boolean | null;
  view: string | null;
  exposure: string | null;
  condition: string | null;
  terrace: boolean | null;
  terrace_m2: number | null;
  bathroom: string | null;
  air_conditioning: boolean | null;
  equipped_kitchen: boolean | null;
  dishwasher: boolean | null;
  washing_machine: boolean | null;
  // prédio
  elevator: boolean | null;
  security: string | null;
  parking: string | null;
  parking_cost_eur: number | null;
  building_condition: string | null;
  amenities: string[] | null;
  // contrato
  lease_type: string | null;
  available_from: string | null;
  available_to: string | null;
  guarantor: string | null;
  guarantor_min_income_eur: number | null;
  student_only: boolean | null;
  // router pendente? (endereço novo/alterado sem rotas calculadas)
  routes_stale: boolean;
  // F. avaliação (Nota Lar [auto] fica para quando os pesos forem definidos)
  brightness_1_5: number | null;
  noise_1_5: number | null;
  pros: string | null;
  cons: string | null;
  personal_notes: string | null;
  // origem
  source_portal: string | null;
  listing_url: string | null;
  photo_url: string | null;
  contact_info: string | null; // landlord/agência — o canal de quem decide do Brasil
}

/** Uma aula do horário (class_schedule). */
export interface ClassSlot {
  course_name: string | null;
  weekday: number;
  start_time: string | null;
  end_time: string | null;
}

/** Estudos em profundidade (GET /api/apartments/[id]/study). */
export interface StudyDetail {
  desk_space: boolean | null;
  fiber_internet: boolean | null;
  fiber_speed: string | null;
  quiet_focus_1_5: number | null;
  natural_light_1_5: number | null;
  coworking_count_10min: number | null;
  campus_days_per_week: number | null;
  typical_class_hours: string | null;
  early_or_night: boolean | null;
  nearest_library_min: number | null;
  campus_min: number | null;
  schedule: ClassSlot[];
}

/** "Carro vale a pena?" — tempo × dinheiro (GET /api/apartments/[id]/car-vs-nocar). */
export interface CarVsNoCar {
  apartment_id?: string;
  apartment_name?: string;
  horas_mes_com_carro: number | null;
  horas_mes_sem_carro: number | null;
  horas_economizadas: number | null;
  custo_mes_com_carro: number | null;
  custo_mes_sem_carro: number | null;
  custo_extra_do_carro: number | null;
  eur_por_hora_economizada: number | null;
  hourly_value_eur: number | null;
}

/** Mobilidade em profundidade (GET /api/apartments/[id]/pillar/mobility). */
export interface MobilityDetail {
  campus_drive_min: number | null;
  campus_transit_min: number | null;
  nearest_gare_name: string | null;
  nearest_gare_min: number | null;
  nearest_bus_stop_min: number | null;
  nearest_gas_station_min: number | null;
  distance_a8_min: number | null;
  envibus_lines: string | null;
  direct_bus_to_sophia: boolean | null;
  building_parking: string | null;
}

/** Um "mais próximo" por categoria (v_apartment_nearest). */
export interface NearestPlace {
  category: string;
  place_name: string;
  mode: "driving" | "transit" | "walking";
  duration_min: number | null;
  distance_m: number | null;
}

/** Uma igreja com rota a partir do apê (GET /api/apartments/[id]/churches).
 *  Pivota os modos: a pé (walk) e de carro (drive). `drive*` pode ser null. */
export interface ChurchPlace {
  id: string;
  name: string;
  walkMin: number | null;
  walkM: number | null;
  driveMin: number | null;
  driveM: number | null;
}

/** Campos derivados de mobilidade (v_mobility_derived). */
export interface MobilityDerived {
  nearest_bus_stop_min: number | null;
  nearest_gare_min: number | null;
  nearest_gare_name: string | null;
  nearest_gas_station_min: number | null;
  distance_a8_min: number | null;
}

/** Campos derivados de estudos (v_study_access). */
export interface StudyAccess {
  nearest_library_min: number | null;
  campus_library_min: number | null;
}

/** Custos derivados do próprio apê (v_apartment_costs). */
export interface ApartmentCosts {
  rent_total_eur: number | null;
  entry_cost_eur: number | null;
  effective_cost_eur: number | null;
}

/** Supermercado discount mais próximo (v_apartment_supermarket). */
export interface DiscountSupermarket {
  place_name: string;
  price_index: number | null;
  duration_min: number | null;
}

/** Hub de viagem (aeroporto NCE, A8, destinos) com tempo de carro do apê. */
export interface TravelHub {
  name: string;
  hub_type: string; // aeroporto | gare | a8 | destino
  duration_min: number | null;
}

/** Estado de config do painel "Ajustes" (GET /api/config). */
export interface AiSubscription {
  id: string;
  name: string;
  monthly_eur: number;
}
export interface CarConfigRow {
  id: string;
  scenario: string;
  source: string | null; // site/fonte (cargo-flex, Sixt…)
  model: string | null;
  km_included: number | null;
  monthly_eur: number | null;
  purchase_price_eur: number | null;
  resale_estimate_eur: number | null;
  months: number | null;
  insurance_eur: number | null;
  insurance_deductible_eur: number | null; // franquia
  tolls_eur: number | null;
  home_parking_eur: number | null;
  maintenance_eur: number | null;
}
export interface ConfigData {
  aiSubscriptions: AiSubscription[];
  food: {
    monthly_realistic_eur: number | null;
    monthly_optimized_eur: number | null;
    buy_profile: string | null;
  } | null;
  transit: { student_pass_eur: number | null } | null;
  cars: CarConfigRow[];
  settings: {
    fuel_price_eur_per_l: number | null;
    car_consumption_l_per_100km: number | null;
    active_car_scenario: string;
    food_mode: string;
    mass_availability_window: string | null;
    supermarket_budget_eur: number | null; // budget estipulado p/ mercado
    restaurant_budget_eur: number | null; // budget estipulado p/ restaurantes
    transit_plan: string | null; // plano de transporte escolhido
    active_car_id: string | null; // carro escolhido na seção Carro
    supermarket_trips_per_month: number | null; // idas ao mercado /mês
    gym_trips_per_month: number | null; // treinos /mês (gasolina até a academia)
    church_trips_per_month: number | null; // missas /mês (gasolina até a igreja)
    travel_budget_eur: number | null; // budget de viagens
    hair_budget_eur: number | null; // budget de cabeleireiro
    shopping_budget_eur: number | null; // budget de shopping/compras
    health_budget_eur: number | null; // budget de saúde
  };
}

/** Overview completo de um apê (GET /api/apartments/[id]/overview). */
export interface ApartmentOverview {
  apartment: {
    id: string;
    name: string;
    address: string | null;
    lat: number | null;
    lng: number | null;
    city: string | null;
    neighborhood: string | null;
    status: ApartmentStatus;
    unit_type: string | null;
    area_m2: number | null;
    rent_base_eur: number | null;
    charges_eur: number | null;
    charges_type: string | null;
    // Campos manuais editáveis inline (Fase 6 — seção "Detalhes do apê").
    deposit_eur: number | null;
    apl_estimate_eur: number | null;
    brightness_1_5: number | null;
    noise_1_5: number | null;
    pros: string | null;
    cons: string | null;
    personal_notes: string | null;
    // true quando o endereço mudou e as rotas ficaram obsoletas (Bloco C).
    routes_stale: boolean;
  };
  cost: CostOfLiving | null;
  costs: ApartmentCosts | null;
  nearest: NearestPlace[];
  mobility: MobilityDerived | null;
  study: StudyAccess | null;
  discountSupermarket: DiscountSupermarket | null;
  travelHubs: TravelHub[];
}

// ── O céu no mapa (Fase 9) ───────────────────────────────────────────────────
/** Um pin do mapa: seleção "esta é a minha" ou ponto fixo (campus/gare/hub). */
export interface MapPin {
  id: string;
  name: string;
  category: string;
  lat: number;
  lng: number;
  walkMin: number | null;
  driveMin: number | null;
  selected: boolean;
}

/** Resposta de GET /api/apartments/[id]/map — o sol + os pins. */
export interface MapData {
  apartment: { id: string; name: string; lat: number | null; lng: number | null };
  pins: MapPin[];
}
