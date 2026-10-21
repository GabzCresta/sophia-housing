#!/usr/bin/env node
/**
 * router.js — motor de rotas (Google Maps) que popula `places` + `routes`.
 * =============================================================================
 * Modelo "moradia = sol": cada apartamento é o centro; os pilares da vida
 * (mercado, igreja, academia, campus, hubs de viagem...) são `places`; a
 * distância/tempo de cada apê a cada place vive em `routes`. Este script preenche
 * isso com dados reais da Google Maps Platform.
 *
 * Ordem: (1) Geocoding do endereço → (2) Descoberta de places (Places API New:
 * Nearby/Text) → (3) Rotas nos modos relevantes (Distance Matrix).
 *
 * Uso:
 *   node scripts/router.js                      # todos os apartamentos
 *   node scripts/router.js --apartment=<uuid>   # só um
 *   node scripts/router.js --force              # ignora o cache (recalcula tudo)
 *   node scripts/router.js --category=<cat>     # re-descobre só essa categoria (respeita
 *                                               # o cache das rotas: só mede as dos places novos)
 *
 * A chave da API é lida SEMPRE de process.env.GOOGLE_MAPS_API_KEY (via .env).
 * =============================================================================
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

// Carrega .env (Node >= 20.12) se as variáveis ainda não estiverem no ambiente.
if (!process.env.GOOGLE_MAPS_API_KEY || !process.env.DATABASE_URL) {
  try { process.loadEnvFile(path.join(projectRoot, '.env')); } catch { /* usa o env do processo */ }
}

const API_KEY = process.env.GOOGLE_MAPS_API_KEY;
const DATABASE_URL = process.env.DATABASE_URL;
if (!API_KEY)      { console.error('✖ GOOGLE_MAPS_API_KEY ausente — defina no .env'); process.exit(1); }
if (!DATABASE_URL) { console.error('✖ DATABASE_URL ausente — defina no .env'); process.exit(1); }

// ── config ───────────────────────────────────────────────────────────────────
const loadJson = (f) => JSON.parse(readFileSync(path.join(projectRoot, 'config', f), 'utf8'));
const CATEGORIES = loadJson('categories.json');   // categorias buscadas "nearby"/"text"
const FIXED_PLACES = loadJson('fixed_places.json'); // campus, aeroporto, A8, gares, destinos
const CHAINS = loadJson('chains.json');           // rede de supermercado → discount/price_index

// ── constantes ───────────────────────────────────────────────────────────────
const CACHE_DAYS = 30;              // route mais nova que isso não é rechamada
const BATCH_DELAY_MS = 200;         // respiro entre lotes (rate limit gentil)
const DM_MAX_DESTINATIONS = 25;     // Distance Matrix aceita vários destinos por request
// Custos ~aproximados por chamada (USD), só para o log de estimativa. Ajuste conforme seu faturamento.
const COST = { geocode: 0.005, nearby: 0.032, text: 0.032, dm_element: 0.005, dm_element_transit: 0.010 };

const stats = {
  geocode: 0, nearby: 0, text: 0,
  dm_requests: 0, dm_elements: 0, dm_elements_transit: 0,
  cache_hits: 0, places_new: 0, places_existing: 0, routes_upserted: 0, errors: 0,
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const chunk = (arr, n) => { const out = []; for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n)); return out; };

// enum priceLevel (Places API New) → inteiro 1-4 do nosso schema
const PRICE_LEVEL = {
  PRICE_LEVEL_INEXPENSIVE: 1, PRICE_LEVEL_MODERATE: 2,
  PRICE_LEVEL_EXPENSIVE: 3, PRICE_LEVEL_VERY_EXPENSIVE: 4,
};
const PLACE_FIELDS = 'places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.priceLevel,places.types';

// =============================================================================
// Google Maps — helpers HTTP (com backoff simples em 429/5xx)
// =============================================================================
async function googleJson(url, opts, label) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    let res;
    try {
      res = await fetch(url, opts);
    } catch (e) {
      if (attempt === 3) throw new Error(`${label}: rede ${e.message}`);
      await sleep(500 * attempt); continue;
    }
    if (res.status === 429 || res.status >= 500) { // rate limit / erro transitório → backoff
      if (attempt === 3) throw new Error(`${label}: HTTP ${res.status}`);
      await sleep(800 * attempt); continue;
    }
    return { http: res.status, body: await res.json() };
  }
}

async function geocode(address) {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&region=fr&language=fr&key=${API_KEY}`;
  const { body } = await googleJson(url, {}, 'Geocoding');
  stats.geocode++;
  if (body.status !== 'OK') {
    if (body.status === 'ZERO_RESULTS') return null;
    throw new Error(`Geocoding ${body.status}: ${body.error_message || ''}`);
  }
  const r = body.results[0];
  const comp = (type) => { const c = r.address_components.find((x) => x.types.includes(type)); return c ? c.long_name : null; };
  return {
    lat: r.geometry.location.lat,
    lng: r.geometry.location.lng,
    city: comp('locality') || comp('postal_town') || comp('administrative_area_level_2'),
    neighborhood: comp('neighborhood') || comp('sublocality') || comp('sublocality_level_1'),
  };
}

async function placesNearby({ lat, lng, radius, includedTypes, maxResultCount, rankPreference }) {
  const { http, body } = await googleJson('https://places.googleapis.com/v1/places:searchNearby', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': API_KEY, 'X-Goog-FieldMask': PLACE_FIELDS },
    // Sem rankPreference o Google ordena por POPULARITY — num raio grande isso
    // esconde os lugares da porta (bug: Auchan a 129 m fora do top 10 de 6 km).
    body: JSON.stringify({ includedTypes, maxResultCount, ...(rankPreference ? { rankPreference } : {}), locationRestriction: { circle: { center: { latitude: lat, longitude: lng }, radius } } }),
  }, 'Places Nearby');
  stats.nearby++;
  if (http !== 200) throw new Error(`Places Nearby ${body.error?.status || http}: ${body.error?.message || ''}`);
  return body.places || [];
}

async function placesText({ lat, lng, radius, textQuery, maxResultCount }) {
  const { http, body } = await googleJson('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': API_KEY, 'X-Goog-FieldMask': PLACE_FIELDS },
    body: JSON.stringify({ textQuery, maxResultCount, locationBias: { circle: { center: { latitude: lat, longitude: lng }, radius } } }),
  }, 'Places Text');
  stats.text++;
  if (http !== 200) throw new Error(`Places Text ${body.error?.status || http}: ${body.error?.message || ''}`);
  return body.places || [];
}

async function distanceMatrix({ origin, destinations, mode, departureTime }) {
  const dest = destinations.map((d) => `${d.lat},${d.lng}`).join('|');
  let url = `https://maps.googleapis.com/maps/api/distancematrix/json`
    + `?origins=${origin.lat},${origin.lng}`
    + `&destinations=${encodeURIComponent(dest)}`
    + `&mode=${mode}&language=fr&units=metric&key=${API_KEY}`;
  if (mode === 'transit' && departureTime) url += `&departure_time=${departureTime}`;
  const { body } = await googleJson(url, {}, 'Distance Matrix');
  stats.dm_requests++;
  if (body.status !== 'OK') throw new Error(`Distance Matrix ${body.status}: ${body.error_message || ''}`);
  return body.rows[0]?.elements || [];
}

// =============================================================================
// Regras de negócio
// =============================================================================

// Combustível de UMA perna (ida). O ida+volta é aplicado nas VIEWS (×2), para não
// duplicar aqui: fuel = km × (L/100km ÷ 100) × €/L.
function fuelCost(distance_m, settings) {
  const km = distance_m / 1000;
  const consumption = parseFloat(settings.car_consumption_l_per_100km);
  const price = parseFloat(settings.fuel_price_eur_per_l);
  return +(km * (consumption / 100) * price).toFixed(2);
}

// Casa o nome do lugar com uma rede conhecida → is_discount/price_index/market_type.
function matchChain(name) {
  const lower = (name || '').toLowerCase();
  for (const [chain, info] of Object.entries(CHAINS)) {
    if (lower.includes(chain.toLowerCase())) return { chain, ...info };
  }
  return { chain: name || null, is_discount: false, price_index: 1.0, market_type: null };
}

// Próxima segunda-feira no horário de aula (default 08:00) como unix time (transit exige departure_time futuro).
function nextTransitDeparture(timeStr) {
  const [h, m] = (timeStr || '08:00').split(':').map(Number);
  const now = new Date();
  const d = new Date(now);
  d.setHours(h, m, 0, 0);
  let add = (1 - d.getDay() + 7) % 7;      // dias até a próxima segunda (getDay: 0=dom..6=sáb)
  if (add === 0 && d <= now) add = 7;      // hoje é segunda mas o horário já passou
  d.setDate(d.getDate() + add);
  if (d <= now) d.setDate(d.getDate() + 7);
  return Math.floor(d.getTime() / 1000);
}

// =============================================================================
// Banco — helpers de upsert (idempotentes)
// =============================================================================
async function loadSettings(client) {
  const defaults = {
    fuel_price_eur_per_l: '1.90',
    car_consumption_l_per_100km: '6.5',
    transit_departure_time: '08:00',
    nearby_radius_m: '3000',
    max_results_per_category: '10',
  };
  const res = await client.query('select key, value from settings');
  const map = Object.fromEntries(res.rows.map((r) => [r.key, r.value]));
  for (const [k, v] of Object.entries(defaults)) {
    if (map[k] == null) {
      await client.query('insert into settings (key, value) values ($1, $2) on conflict (key) do nothing', [k, v]);
      map[k] = v;
    }
  }
  return map;
}

async function upsertPlace(client, p) {
  const found = await client.query('select id from places where google_place_id = $1', [p.google_place_id]);
  if (found.rows.length) {
    const id = found.rows[0].id;
    await client.query(
      `update places set category=$2, name=$3, address=$4, lat=$5, lng=$6, rating=$7, updated_at=now() where id=$1`,
      [id, p.category, p.name, p.address, p.lat, p.lng, p.rating],
    );
    stats.places_existing++;
    return id;
  }
  const ins = await client.query(
    `insert into places (category, name, address, lat, lng, google_place_id, rating, is_manual)
     values ($1,$2,$3,$4,$5,$6,$7,$8) returning id`,
    [p.category, p.name, p.address, p.lat, p.lng, p.google_place_id, p.rating, p.is_manual ?? false],
  );
  stats.places_new++;
  return ins.rows[0].id;
}

async function upsertSupermarketDetails(client, placeId, name, types = []) {
  const c = matchChain(name);
  // Sinal do Google: se o tipo é 'discount_supermarket' e o nome não bateu uma rede discount,
  // marca discount mesmo assim (ex.: Aldi/Lidl que o Google rotula direto).
  if (!c.is_discount && Array.isArray(types) && types.includes('discount_supermarket')) {
    c.is_discount = true;
    if (c.price_index == null || c.price_index >= 1.0) c.price_index = 0.85;
    c.market_type = c.market_type || 'discount';
  }
  const found = await client.query('select id from supermarket_details where place_id=$1', [placeId]);
  if (found.rows.length) {
    await client.query(
      `update supermarket_details set chain=$2, market_type=$3, is_discount=$4, price_index=$5, updated_at=now() where place_id=$1`,
      [placeId, c.chain, c.market_type, c.is_discount, c.price_index]);
  } else {
    await client.query(
      `insert into supermarket_details (place_id, chain, market_type, is_discount, price_index) values ($1,$2,$3,$4,$5)`,
      [placeId, c.chain, c.market_type, c.is_discount, c.price_index]);
  }
}

// Cozinha inferida dos types do Google → enum cuisine_type. Ordem importa
// (pizza antes de italian: pizzarias carregam os dois types). Sem match = null
// (não chutamos "outro" — isso é escolha humana).
const CUISINE_FROM_TYPES = [
  ['pizza_restaurant', 'pizza'],
  ['italian_restaurant', 'italiana'],
  ['french_restaurant', 'francesa'],
  ['mediterranean_restaurant', 'mediterranea'],
  ['greek_restaurant', 'mediterranea'],
  ['lebanese_restaurant', 'mediterranea'],
  ['turkish_restaurant', 'kebab'],
  ['fine_dining_restaurant', 'gastronomica'],
];
function inferCuisine(gTypes) {
  for (const [t, cuisine] of CUISINE_FROM_TYPES) if (gTypes.includes(t)) return cuisine;
  return null;
}

async function upsertRestaurantDetails(client, placeId, priceLevel, gTypes = []) {
  const cuisine = inferCuisine(gTypes);
  const found = await client.query('select id from restaurant_details where place_id=$1', [placeId]);
  if (found.rows.length) {
    // coalesce(cuisine, $3): o que o Gabriel gravou à mão nunca é sobrescrito
    await client.query(
      `update restaurant_details set price_level=coalesce($2, price_level), cuisine=coalesce(cuisine, $3), updated_at=now() where place_id=$1`,
      [placeId, priceLevel, cuisine],
    );
  } else {
    await client.query(`insert into restaurant_details (place_id, price_level, cuisine) values ($1,$2,$3)`, [placeId, priceLevel, cuisine]);
  }
}

async function upsertTravelHubDetails(client, placeId, hubType) {
  const found = await client.query('select id from travel_hub_details where place_id=$1', [placeId]);
  if (found.rows.length) {
    await client.query(`update travel_hub_details set hub_type=$2, updated_at=now() where place_id=$1`, [placeId, hubType]);
  } else {
    await client.query(`insert into travel_hub_details (place_id, hub_type) values ($1,$2)`, [placeId, hubType]);
  }
}

async function isRouteFresh(client, apartmentId, placeId, mode, force) {
  if (force) return false;
  const r = await client.query(
    `select 1 from routes
      where apartment_id=$1 and place_id=$2 and mode=$3
        and computed_at is not null
        and computed_at > now() - ($4 || ' days')::interval`,
    [apartmentId, placeId, mode, String(CACHE_DAYS)]);
  return r.rows.length > 0;
}

async function upsertRoute(client, apartmentId, placeId, mode, distance_m, duration_s, fuel) {
  await client.query(
    `insert into routes (apartment_id, place_id, mode, distance_m, duration_s, fuel_cost_eur, computed_at)
     values ($1,$2,$3,$4,$5,$6, now())
     on conflict (apartment_id, place_id, mode) do update
       set distance_m=excluded.distance_m, duration_s=excluded.duration_s,
           fuel_cost_eur=excluded.fuel_cost_eur, computed_at=now(), updated_at=now()`,
    [apartmentId, placeId, mode, distance_m, duration_s, fuel]);
  stats.routes_upserted++;
}

// =============================================================================
// Etapas
// =============================================================================

// Garante os places FIXOS (idempotente via google_place_id sintético "fixed:<key>").
async function seedFixedPlaces(client) {
  const out = [];
  for (const fp of FIXED_PLACES) {
    const id = await upsertPlace(client, {
      category: fp.category, name: fp.name, address: fp.address || null,
      lat: fp.lat, lng: fp.lng, google_place_id: `fixed:${fp.key}`, rating: null, is_manual: true,
    });
    if (fp.category === 'travel_hub') await upsertTravelHubDetails(client, id, fp.hub_type || 'destino');
    out.push({ placeId: id, category: fp.category, lat: fp.lat, lng: fp.lng, name: fp.name, modes: fp.modes });
  }
  return out;
}

// Descobre places de vizinhança para UM apartamento e devolve os relevantes p/ rota.
// onlyCategory: quando setado, descobre SÓ essa categoria (ex.: 'supermarket') — evita
// gastar chamadas re-descobrindo as demais.
async function discoverPlaces(client, apt, settings, onlyCategory = null) {
  const relevant = [];
  const radiusDefault = parseInt(settings.nearby_radius_m, 10);
  const maxResults = parseInt(settings.max_results_per_category, 10);

  const cats = onlyCategory ? CATEGORIES.filter((c) => c.category === onlyCategory) : CATEGORIES;
  for (const cat of cats) {
    const radius = cat.radius_m || radiusDefault;
    let results = [];
    try {
      if (cat.includedTypes) {
        results = await placesNearby({ lat: apt.lat, lng: apt.lng, radius, includedTypes: cat.includedTypes, maxResultCount: maxResults });
        // Busca dupla: a de cima (POPULARITY, raio grande) caça os discounts;
        // esta, por DISTÂNCIA num raio curto, garante os lugares do dia-a-dia
        // que a popularidade esconde. Dedup por google place id.
        if (cat.near_radius_m) {
          const near = await placesNearby({
            lat: apt.lat, lng: apt.lng, radius: cat.near_radius_m,
            includedTypes: cat.near_included_types || cat.includedTypes,
            // teto da API é 20 — a busca por distância satura rápido em bairro denso
            maxResultCount: Math.min(cat.near_max_results || maxResults, 20), rankPreference: 'DISTANCE',
          });
          const seen = new Set(results.map((r) => r.id));
          results = [...results, ...near.filter((r) => !seen.has(r.id))];
        }
      } else if (cat.textQuery) {
        results = await placesText({ lat: apt.lat, lng: apt.lng, radius, textQuery: cat.textQuery, maxResultCount: maxResults });
      }
    } catch (e) {
      stats.errors++;
      console.warn(`     ⚠ ${cat.category}: ${e.message}`);
      if (/REQUEST_DENIED/.test(e.message)) throw e; // problema de chave/API → fatal
      continue;
    }

    for (const g of results) {
      if (!g.location) continue;
      const place = {
        category: cat.category,
        name: g.displayName?.text || '(sem nome)',
        address: g.formattedAddress || null,
        lat: g.location.latitude, lng: g.location.longitude,
        google_place_id: g.id, rating: g.rating ?? null, is_manual: false,
      };
      const id = await upsertPlace(client, place);
      if (cat.category === 'supermarket') await upsertSupermarketDetails(client, id, place.name, g.types || []);
      if (cat.category === 'restaurant') await upsertRestaurantDetails(client, id, PRICE_LEVEL[g.priceLevel] ?? null, g.types || []);
      relevant.push({ placeId: id, category: cat.category, lat: place.lat, lng: place.lng, name: place.name, modes: cat.modes });
    }
    console.log(`     • ${cat.category.padEnd(12)} ${results.length} lugares (raio ${radius}m)`);
    await sleep(BATCH_DELAY_MS);
  }
  return relevant;
}

// Calcula rotas do apê a cada place relevante, por modo, com cache + batching.
async function computeRoutes(client, apt, places, settings, force) {
  const departureTime = nextTransitDeparture(settings.transit_departure_time);

  // Dedup por placeId: um mesmo lugar pode voltar em várias categorias (ex.: bar + restaurante).
  // Unir os modos evita elementos redundantes na Distance Matrix (economia de cota).
  const byId = new Map();
  for (const p of places) {
    if (p.lat == null || p.lng == null) continue;
    const cur = byId.get(p.placeId);
    if (cur) cur.modes = [...new Set([...cur.modes, ...p.modes])];
    else byId.set(p.placeId, { ...p, modes: [...p.modes] });
  }
  const uniquePlaces = [...byId.values()];

  for (const mode of ['driving', 'walking', 'transit']) {
    const targets = uniquePlaces.filter((p) => p.modes.includes(mode));

    // filtra o que já está fresco no cache
    const toCompute = [];
    for (const t of targets) {
      if (await isRouteFresh(client, apt.id, t.placeId, mode, force)) stats.cache_hits++;
      else toCompute.push(t);
    }
    if (!toCompute.length) { console.log(`     • ${mode.padEnd(8)} 0 a calcular (${targets.length} em cache)`); continue; }

    let ok = 0, zero = 0;
    for (const batch of chunk(toCompute, DM_MAX_DESTINATIONS)) {
      let elements;
      try {
        elements = await distanceMatrix({
          origin: { lat: apt.lat, lng: apt.lng },
          destinations: batch.map((b) => ({ lat: b.lat, lng: b.lng })),
          mode, departureTime,
        });
      } catch (e) {
        stats.errors++;
        console.warn(`     ⚠ Distance Matrix ${mode}: ${e.message}`);
        if (/OVER_QUERY_LIMIT|REQUEST_DENIED/.test(e.message)) throw e; // fatal
        continue;
      }
      for (let i = 0; i < batch.length; i++) {
        const el = elements[i];
        if (!el || el.status !== 'OK') { zero++; continue; } // ZERO_RESULTS / NOT_FOUND → pula
        const distance_m = el.distance?.value ?? null;
        const duration_s = el.duration?.value ?? null;
        const fuel = mode === 'driving' && distance_m != null ? fuelCost(distance_m, settings) : null;
        await upsertRoute(client, apt.id, batch[i].placeId, mode, distance_m, duration_s, fuel);
        if (mode === 'transit') stats.dm_elements_transit++; else stats.dm_elements++;
        ok++;
      }
      await sleep(BATCH_DELAY_MS);
    }
    console.log(`     • ${mode.padEnd(8)} ${ok} rotas gravadas${zero ? `, ${zero} sem rota` : ''}`);
  }
}

function printSummary() {
  const est = stats.geocode * COST.geocode + stats.nearby * COST.nearby + stats.text * COST.text
    + stats.dm_elements * COST.dm_element + stats.dm_elements_transit * COST.dm_element_transit;
  console.log('\n════════════════════ RESUMO ════════════════════');
  console.log(`  Geocoding:            ${stats.geocode} chamadas`);
  console.log(`  Places Nearby (New):  ${stats.nearby} chamadas`);
  console.log(`  Places Text (New):    ${stats.text} chamadas`);
  console.log(`  Distance Matrix:      ${stats.dm_requests} requests · ${stats.dm_elements + stats.dm_elements_transit} elementos (${stats.dm_elements} normais + ${stats.dm_elements_transit} transit)`);
  console.log(`  Cache hits (rotas):   ${stats.cache_hits}`);
  console.log(`  Places novos:         ${stats.places_new}`);
  console.log(`  Places já existentes: ${stats.places_existing}`);
  console.log(`  Rotas gravadas:       ${stats.routes_upserted}`);
  console.log(`  Erros tolerados:      ${stats.errors}`);
  console.log(`  Custo estimado:       ~US$ ${est.toFixed(3)} (aprox.; ajuste em COST)`);
  console.log('═════════════════════════════════════════════════');
}

// =============================================================================
// API programática (reaproveitada por add-apartment.js) + CLI
// =============================================================================

// Zera as estatísticas para uma nova execução (o módulo pode ser importado e reusado).
export function resetStats() { for (const k of Object.keys(stats)) stats[k] = 0; }

// Abre uma conexão pg usando a MESMA DATABASE_URL do .env (reuso pelo add-apartment).
export async function openClient() {
  const client = new pg.Client({ connectionString: DATABASE_URL });
  await client.connect();
  return client;
}

// Roda o pipeline (fixos → geocoding → descoberta → rotas). `onlyApartment` restringe
// a 1 apê; `force` ignora o cache. Retorna as estatísticas da execução.
export async function runRouter({ onlyApartment = null, force = false, onlyCategory = null } = {}) {
  resetStats();
  const client = await openClient();
  try {
    const settings = await loadSettings(client);
    console.log(`⚙  raio=${settings.nearby_radius_m}m · max/cat=${settings.max_results_per_category} · combustível=${settings.fuel_price_eur_per_l}€/L · consumo=${settings.car_consumption_l_per_100km}L/100km`);
    console.log(force ? '⚡ --force ativo: ignorando cache' : `🧊 cache de rotas: ${CACHE_DAYS} dias`);

    console.log('\n➊ Places FIXOS (campus, aeroporto, A8, gares, destinos)');
    const fixed = await seedFixedPlaces(client);
    console.log(`   ${fixed.length} places fixos garantidos`);

    const where = onlyApartment ? 'where id = $1' : '';
    const params = onlyApartment ? [onlyApartment] : [];
    const apts = (await client.query(`select id, name, address, lat, lng from apartments ${where} order by created_at`, params)).rows;
    if (!apts.length) { console.log('Nenhum apartamento encontrado.'); return stats; }

    for (const apt of apts) {
      console.log(`\n🏠 ${apt.name}  (${apt.id})`);

      // ➋ Geocoding (pula se já tem coordenadas, salvo force)
      if ((apt.lat == null || apt.lng == null || force) && apt.address) {
        try {
          const g = await geocode(apt.address);
          if (g) {
            await client.query(
              `update apartments set lat=$2, lng=$3, city=coalesce($4, city), neighborhood=coalesce($5, neighborhood), updated_at=now() where id=$1`,
              [apt.id, g.lat, g.lng, g.city, g.neighborhood]);
            apt.lat = g.lat; apt.lng = g.lng;
            console.log(`   ➋ Geocoding → ${g.lat}, ${g.lng} · ${g.city || '?'} / ${g.neighborhood || '?'}`);
          } else {
            console.log('   ➋ Geocoding → ZERO_RESULTS');
          }
        } catch (e) { stats.errors++; console.warn(`   ⚠ Geocoding: ${e.message}`); }
      } else {
        console.log(`   ➋ Geocoding: pulado (já tem lat/lng)`);
      }
      if (apt.lat == null || apt.lng == null) { console.warn('   ⚠ sem coordenadas → pulando descoberta/rotas'); continue; }

      // Cache no nível do apê: se já há rotas frescas, não re-descobre nem recalcula
      // (a descoberta de places também custa cota). force ignora. onlyCategory também
      // ignora o skip (precisa re-descobrir aquela categoria), mas o cache POR ROTA
      // continua valendo em computeRoutes → só mede as rotas dos places novos.
      if (!force && !onlyCategory) {
        const fresh = (await client.query(
          `select count(*)::int as n from routes where apartment_id=$1 and computed_at > now() - ($2 || ' days')::interval`,
          [apt.id, String(CACHE_DAYS)])).rows[0].n;
        if (fresh > 0) {
          stats.cache_hits += fresh;
          console.log(`   ⏭  ${fresh} rotas frescas em cache → pulando descoberta/rotas (use --force p/ recalcular)`);
          continue;
        }
      }

      // ➌ Descoberta de places (só a categoria pedida, se onlyCategory)
      console.log(`   ➌ Descoberta de places (nearby/text)${onlyCategory ? ` — só ${onlyCategory}` : ''}:`);
      const nearby = await discoverPlaces(client, apt, settings, onlyCategory);

      // ➍ Rotas
      console.log('   ➍ Rotas (Distance Matrix):');
      await computeRoutes(client, apt, [...nearby, ...fixed], settings, force);
    }

    printSummary();
    return stats;
  } finally {
    await client.end();
  }
}

// Execução via CLI: só quando router.js é o entry point (não quando importado).
const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const force = process.argv.includes('--force');
  const only = (process.argv.find((a) => a.startsWith('--apartment=')) || '').split('=')[1] || null;
  const onlyCategory = (process.argv.find((a) => a.startsWith('--category=')) || '').split('=')[1] || null;
  runRouter({ onlyApartment: only, force, onlyCategory }).catch((e) => { console.error('\n✖ Erro fatal:', e.message); process.exitCode = 1; });
}
