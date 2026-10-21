#!/usr/bin/env node
/**
 * add-apartment.js — cadastra um apartamento a partir do texto de um anúncio.
 * =============================================================================
 * Fluxo (human in the loop):
 *   1. Extração heurística dos campos do pilar "Lar" (nunca inventa; NULL se ausente).
 *   2. CHECKPOINT bloqueante no endereço ANTES de qualquer chamada à Google
 *      (endereço errado contamina TODAS as distâncias e o custo).
 *   3. Inserção em `apartments` só após confirmação.
 *   4. Dispara o router nesse apê (reusa runRouter de router.js — mesmo .env/conexão).
 *   5. Resumo final: uuid, geocode, places/rotas, custo de vida.
 *
 * Entrada do anúncio: arquivo (argumento) OU stdin (pipe).
 *   node scripts/add-apartment.js anuncio.txt
 *   pbpaste | node scripts/add-apartment.js
 * Flags: --force (repassa ao router).
 *
 * A extração é heurística (regex, textos em francês): extrai o que tem sinal claro e
 * deixa NULL o resto — por isso o checkpoint humano é obrigatório.
 * =============================================================================
 */

import { readFileSync, createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { runRouter, openClient } from './router.js';

// Colunas do pilar "Lar" que a extração tenta preencher (o resto fica NULL / manual).
const COLUMNS = [
  'name', 'source_portal', 'listing_url', 'address',
  'rent_base_eur', 'charges_eur', 'charges_type', 'first_month_eur', 'admin_fee_eur', 'deposit_eur',
  'unit_type', 'separate_bedroom', 'area_m2', 'floor', 'furnished', 'condition',
  'terrace', 'terrace_m2', 'view', 'exposure', 'air_conditioning', 'equipped_kitchen',
  'dishwasher', 'washing_machine', 'bathroom', 'elevator', 'security', 'parking', 'parking_cost_eur',
  'amenities', 'lease_type', 'available_from', 'available_to', 'guarantor', 'student_only',
  'mandatory_insurance_eur',
];

// =============================================================================
// Parsers auxiliares
// =============================================================================

// "1 200,50" → 1200.5 · "1.200" → 1200 · "28,5" → 28.5 · "720" → 720
function parseEuro(s) {
  if (s == null) return null;
  let t = String(s).replace(/[\s  ]/g, '');
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.'); // vírgula = decimal
  else t = t.replace(/\.(?=\d{3}(\D|$))/g, '');                    // ponto de milhar
  const n = parseFloat(t);
  return Number.isFinite(n) ? n : null;
}

// "01/09/2026" → "2026-09-01"
function parseFrDate(s) {
  if (!s) return null;
  const m = s.match(/(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})/);
  if (!m) return null;
  let [, d, mo, y] = m;
  if (y.length === 2) y = '20' + y;
  return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

// =============================================================================
// Extração — a partir do texto, preenche os campos com sinal claro; resto = NULL.
// =============================================================================
function extractApartment(raw) {
  const text = raw.replace(/\r/g, '');
  const low = text.toLowerCase();
  const grab = (re, src = low) => { const m = src.match(re); return m ? m[1].trim() : null; };
  const N = /([\d.\s  ,]+)/.source; // bloco numérico "europeu"

  const f = Object.fromEntries(COLUMNS.map((c) => [c, null]));

  // Portal + URL
  f.listing_url = grab(/(https?:\/\/[^\s<>"')]+)/i, text);
  if (f.listing_url) {
    const host = f.listing_url.replace(/^https?:\/\//i, '').split('/')[0].toLowerCase();
    const portals = { seloger: 'SeLoger', leboncoin: 'LeBonCoin', pap: 'PAP', studapart: 'Studapart',
      bienici: 'Bien’ici', 'logic-immo': 'Logic-Immo', logicimmo: 'Logic-Immo', orpi: 'Orpi', fnaim: 'FNAIM' };
    f.source_portal = Object.entries(portals).find(([k]) => host.includes(k))?.[1] || host.replace(/^www\./, '');
  }

  // Endereço (crítico) — várias tentativas; o checkpoint deixa corrigir se falhar.
  f.address = grab(/adresse\s*[:\-]\s*(.+)/i, text)
    || grab(/((?:\d+\s*,?\s*)?(?:rue|avenue|av\.?|bd|boulevard|chemin|impasse|all[ée]e|place|route|quai|traverse|mont[ée]e)\b[^\n]*?\d{5}\s+[A-Za-zÀ-ÿ' -]+)/i, text)
    || grab(/(\d{5}\s+[A-Za-zÀ-ÿ' -]{2,})/i, text);

  // Custo
  f.rent_base_eur = parseEuro(grab(new RegExp(`loyer[^0-9€]{0,30}?${N}\\s*€`, 'i'))
    || grab(new RegExp(`${N}\\s*€\\s*(?:\\/|par)\\s*mois`, 'i')));
  f.charges_eur = parseEuro(grab(new RegExp(`charges?[^0-9€]{0,30}?${N}\\s*€`, 'i')));
  if (/charges comprises|loyer\s*c\.?c\.?\b|\bcc\b\s*\(/i.test(low)) f.charges_type = 'CC';
  else if (/hors charges|loyer\s*h\.?c\.?\b|\+\s*charges/i.test(low)) f.charges_type = 'HC';
  f.deposit_eur = parseEuro(grab(new RegExp(`(?:d[ée]p[ôo]t de garantie|caution)[^0-9€]{0,30}?${N}\\s*€`, 'i')));
  f.admin_fee_eur = parseEuro(grab(new RegExp(`(?:honoraires|frais d.?agence|frais de dossier)[^0-9€]{0,40}?${N}\\s*€`, 'i')));
  f.mandatory_insurance_eur = parseEuro(grab(new RegExp(`assurance[^0-9€]{0,30}?${N}\\s*€`, 'i')));

  // Unidade
  if (/\bstudio\b/i.test(low)) f.unit_type = 'studio';
  else {
    const t = low.match(/\b[tf]\s?([1-3])\b/);
    if (t) f.unit_type = 'T' + t[1];
    else { const p = low.match(/(\d)\s*pi[èe]ces?/); if (p) f.unit_type = p[1] === '1' ? 'T1' : 'T' + Math.min(3, +p[1]); }
  }
  if (/chambre s[ée]par[ée]e|chambre ind[ée]pendante/i.test(low)) f.separate_bedroom = true;
  else if (f.unit_type === 'studio') f.separate_bedroom = false;
  else if (f.unit_type === 'T2' || f.unit_type === 'T3') f.separate_bedroom = true;

  f.area_m2 = parseEuro(grab(/surface[^0-9]{0,20}?([\d.,]+)\s*m(?:²|2)/i) || grab(/([\d.,]+)\s*m(?:²|2)/i));
  if (/rez[- ]de[- ]chauss[ée]e|\brdc\b|rez-de-jardin/i.test(low)) f.floor = 0;
  else { const m = low.match(/(\d+)\s*(?:er|ème|eme|e)?\s*[ée]tage/i); if (m) f.floor = +m[1]; }

  if (/non[ -]?meubl[ée]|\bvide\b/i.test(low)) f.furnished = false;
  else if (/meubl[ée]/i.test(low)) f.furnished = true;

  if (/\bneuf\b|\bneuve\b/i.test(low)) f.condition = 'novo';
  else if (/r[ée]nov[ée]|refait/i.test(low)) f.condition = 'reformado';
  else if (/[àa] r[ée]nover|travaux [àa] pr[ée]voir/i.test(low)) f.condition = 'a_renovar';
  else if (/bon [ée]tat/i.test(low)) f.condition = 'bom';

  if (/terrasse/i.test(low)) f.terrace = true;
  f.terrace_m2 = parseEuro(grab(/terrasse[^0-9]{0,20}?([\d.,]+)\s*m(?:²|2)/i));

  if (/vue (?:sur (?:la )?)?mer/i.test(low)) f.view = 'mar';
  else if (/vue (?:sur )?jardin/i.test(low)) f.view = 'jardim';
  else if (/vue (?:sur )?rue/i.test(low)) f.view = 'rua';
  else if (/patio/i.test(low)) f.view = 'patio';

  if (/exposition[^.\n]{0,15}?sud|plein sud|expos[ée][^.\n]{0,10}?sud/i.test(low)) f.exposure = 'S';
  else if (/exposition[^.\n]{0,15}?nord|expos[ée][^.\n]{0,10}?nord/i.test(low)) f.exposure = 'N';
  else if (/exposition[^.\n]{0,15}?est|expos[ée][^.\n]{0,10}?est/i.test(low)) f.exposure = 'L';
  else if (/exposition[^.\n]{0,15}?ouest|expos[ée][^.\n]{0,10}?ouest/i.test(low)) f.exposure = 'O';

  if (/climatisation|climatis[ée]|\bclim\b/i.test(low)) f.air_conditioning = true;
  if (/cuisine [ée]quip[ée]e|cuisine am[ée]nag[ée]e/i.test(low)) f.equipped_kitchen = true;
  if (/lave[ -]?vaisselle/i.test(low)) f.dishwasher = true;
  if (/lave[ -]?linge|machine [àa] laver/i.test(low)) f.washing_machine = true;

  if (/baignoire/i.test(low)) f.bathroom = 'banheira';
  else if (/salle d.?eau|douche/i.test(low)) f.bathroom = 'chuveiro';

  if (/sans ascenseur/i.test(low)) f.elevator = false;
  else if (/ascenseur/i.test(low)) f.elevator = true;

  if (/gardien|concierge/i.test(low)) f.security = 'guarda';
  else if (/digicode/i.test(low)) f.security = 'digicode';
  else if (/interphone/i.test(low)) f.security = 'interfone';
  else if (/vid[ée]osurveillance|cam[ée]ra/i.test(low)) f.security = 'cameras';

  if (/sans (?:parking|garage|stationnement)|pas de (?:parking|garage)/i.test(low)) f.parking = 'nenhum';
  else if (/\bbox\b|sous-sol|souterrain/i.test(low)) f.parking = 'box_subsolo';
  else if (/parking|garage|stationnement/i.test(low)) f.parking = 'rua';
  f.parking_cost_eur = parseEuro(grab(new RegExp(`(?:parking|garage|box)[^0-9€]{0,25}?${N}\\s*€`, 'i')));

  const amen = [];
  if (/piscine/i.test(low)) amen.push('piscina');
  if (/\btennis\b/i.test(low)) amen.push('tenis');
  if (/salle de sport|fitness|salle de gym/i.test(low)) amen.push('academia');
  if (/jardin (?:commun|privatif|partag)|espace vert/i.test(low)) amen.push('jardim');
  f.amenities = amen.length ? amen : null;

  if (/bail [ée]tudiant|contrat [ée]tudiant/i.test(low)) f.lease_type = 'etudiant';
  else if (/bail mobilit[ée]|contrat mobilit[ée]/i.test(low)) f.lease_type = 'mobilite';

  f.available_from = parseFrDate(grab(/(?:disponible|[àa] partir|dispo)[^0-9]{0,15}?(\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4})/i));

  if (/visale/i.test(low)) f.guarantor = 'visale';
  else if (/caution parentale|garant[e]? (?:parent|familial)/i.test(low)) f.guarantor = 'pais';
  else if (/studapart/i.test(low)) f.guarantor = 'studapart';

  if (/r[ée]serv[ée] (?:aux )?[ée]tudiants|logement [ée]tudiant|[ée]tudiants? uniquement/i.test(low)) f.student_only = true;

  // name é NOT NULL: primeira linha significativa, com fallback.
  const firstLine = text.split('\n').map((s) => s.trim()).find(Boolean);
  f.name = (firstLine && firstLine.length <= 120) ? firstLine : `${f.unit_type || 'Apartamento'}${f.address ? ' — ' + f.address.slice(0, 40) : ''}`;

  return f;
}

// =============================================================================
// Persistência
// =============================================================================
async function insertApartment(client, f) {
  const cols = [...COLUMNS, 'status'];
  const vals = [...COLUMNS.map((c) => f[c] ?? null), 'candidatar'];
  const ph = cols.map((_, i) => '$' + (i + 1)).join(', ');
  const r = await client.query(`insert into apartments (${cols.join(', ')}) values (${ph}) returning id`, vals);
  return r.rows[0].id;
}

// Atualiza um apê existente (mesmo listing_url). coalesce mantém o que já havia quando a
// nova extração vier NULL — não destrói dados preenchidos à mão.
async function updateApartment(client, id, f) {
  const sets = COLUMNS.map((c, i) => `${c} = coalesce($${i + 2}, ${c})`).join(', ');
  await client.query(`update apartments set ${sets}, updated_at = now() where id = $1`,
    [id, ...COLUMNS.map((c) => f[c] ?? null)]);
}

// =============================================================================
// I/O
// =============================================================================
function readInput() {
  const fileArg = process.argv.slice(2).find((a) => !a.startsWith('--'));
  if (fileArg) return { adText: readFileSync(fileArg, 'utf8'), adFromFile: true };
  if (!process.stdin.isTTY) return { adText: readFileSync(0, 'utf8'), adFromFile: false }; // stdin (pipe)
  return { adText: null, adFromFile: true };
}

// Prompt: se o anúncio veio de arquivo, lê as respostas do stdin; se veio do stdin (pipe),
// lê do /dev/tty (senão não teria como perguntar). Usa o iterador de linhas (uma por prompt):
// funciona interativo E com pipe, e trata EOF como resposta vazia (= abort seguro), sem crash.
function makePrompter(adFromFile) {
  const input = adFromFile ? process.stdin : createReadStream('/dev/tty');
  const rl = createInterface({ input });
  const lines = rl[Symbol.asyncIterator]();
  return {
    ask: async (q) => {
      process.stdout.write(q);
      const { value, done } = await lines.next();
      return done ? '' : String(value).trim();
    },
    close: () => { try { rl.close(); } catch { /* ok */ } },
  };
}

function printExtraction(f) {
  const shown = COLUMNS
    .filter((c) => f[c] != null && !(Array.isArray(f[c]) && !f[c].length))
    .map((c) => `${c}=${Array.isArray(f[c]) ? '[' + f[c].join(',') + ']' : f[c]}`);
  const nulls = COLUMNS.filter((c) => f[c] == null);
  console.log('──────────────── EXTRAÇÃO ────────────────');
  console.log('  ✔ extraídos: ' + (shown.length ? shown.join(' · ') : '(nenhum)'));
  console.log(`  ○ NULL (${nulls.length}): ${nulls.join(', ')}`);
}

async function printFinalSummary(apartmentId) {
  const client = await openClient();
  try {
    const apt = (await client.query('select name, address, lat, lng, city, neighborhood from apartments where id=$1', [apartmentId])).rows[0];
    const r = (await client.query('select count(*)::int routes, count(distinct place_id)::int places from routes where apartment_id=$1', [apartmentId])).rows[0];
    const near = (await client.query(
      `select category, place_name, duration_min from v_apartment_nearest
        where apartment_id=$1 and category in ('campus','supermarket','gare','church','gym','bakery') order by category`, [apartmentId])).rows;
    const col = (await client.query('select * from v_apartment_cost_of_living where apartment_id=$1', [apartmentId])).rows[0];

    console.log('\n═══════════════════ RESUMO FINAL ═══════════════════');
    console.log(`  uuid:         ${apartmentId}`);
    console.log(`  endereço:     ${apt.address || '(?)'}`);
    console.log(`  geocode:      ${apt.lat}, ${apt.lng} · ${apt.city || '?'}${apt.neighborhood ? ' / ' + apt.neighborhood : ''}`);
    console.log(`  places/rotas: ${r.places} places medidos · ${r.routes} rotas`);
    console.log('  mais próximos:');
    for (const n of near) console.log(`      - ${n.category.padEnd(11)} ${n.place_name} (${n.duration_min} min)`);
    if (col) {
      console.log('  custo de vida (€/mês, rastreável):');
      console.log(`      aluguel efetivo ${col.rent_effective_eur} · combustível→campus ${col.fuel_campus_eur} · comida ${col.food_eur}`);
      console.log(`      carro ${col.car_fixed_eur} · IA ${col.ai_eur} · transporte ${col.transit_eur}`);
      console.log(`      ►► TOTAL: ${col.total_month_eur} €/mês`);
    }
    console.log('═════════════════════════════════════════════════════');
  } finally { await client.end(); }
}

// =============================================================================
// Fluxo principal
// =============================================================================
async function main() {
  const force = process.argv.includes('--force');
  const { adText, adFromFile } = readInput();
  if (!adText || !adText.trim()) {
    console.error('✖ Sem texto de anúncio. Use: node scripts/add-apartment.js anuncio.txt  (ou via stdin)');
    process.exit(1);
  }

  const f = extractApartment(adText);
  printExtraction(f);

  const io = makePrompter(adFromFile);
  let apartmentId = null, isUpdate = false;
  try {
    // ── CHECKPOINT (bloqueante) — endereço antes de qualquer chamada à Google ──
    console.log('\n──────────────── CHECKPOINT ────────────────');
    console.log(`  Endereço:  ${f.address || '(NÃO ENCONTRADO — use "editar")'}`);
    console.log(`  Resumo:    ${f.unit_type || '?'} · ${f.area_m2 ? f.area_m2 + ' m²' : '? m²'} · aluguel ${f.rent_base_eur ?? '?'} € ${f.charges_type || ''}`
      + ` · quarto separado: ${f.separate_bedroom == null ? '?' : (f.separate_bedroom ? 'sim' : 'não')}`);
    const ans = (await io.ask('  Endereço correto? [s/n/editar]: ')).toLowerCase();

    if (['n', 'nao', 'não', 'no', ''].includes(ans)) {
      console.log('✖ Abortado. Nada inserido, nenhuma chamada à Google.');
      return;
    }
    if (['editar', 'edit', 'e'].includes(ans)) {
      const edited = await io.ask('  Novo endereço: ');
      if (!edited) { console.log('✖ Endereço vazio → abortado.'); return; }
      f.address = edited;
    } else if (!['s', 'sim', 'y', 'yes'].includes(ans)) {
      console.log('✖ Resposta não reconhecida → abortado por segurança (o checkpoint nunca assume "s").');
      return;
    }
    if (!f.address) { console.log('✖ Sem endereço → abortado (o router mede tudo a partir dele).'); return; }

    // ── Idempotência (listing_url) + inserção ──
    const client = await openClient();
    try {
      if (f.listing_url) {
        const dup = await client.query('select id from apartments where listing_url=$1', [f.listing_url]);
        if (dup.rows.length) {
          const existingId = dup.rows[0].id;
          const up = (await io.ask(`  ⚠ Já existe um apê com esse listing_url (${existingId}). Atualizar? [s/n]: `)).toLowerCase();
          if (!['s', 'sim', 'y', 'yes'].includes(up)) { console.log('✖ Abortado — não duplicado.'); return; }
          await updateApartment(client, existingId, f);
          apartmentId = existingId; isUpdate = true;
        }
      }
      if (!apartmentId) apartmentId = await insertApartment(client, f);
    } finally {
      await client.end();
    }
    console.log(`\n✅ Apartamento ${isUpdate ? 'ATUALIZADO' : 'INSERIDO'}: ${apartmentId}`);
  } finally {
    io.close(); // libera stdin/tty e permite o processo encerrar
  }

  if (!apartmentId) return; // abortado no checkpoint

  // ── Disparo do router (reusa a lógica existente; respeita o cache) ──
  console.log('\n──────────────── ROUTER ────────────────');
  await runRouter({ onlyApartment: apartmentId, force });

  // ── Resumo final para validação na hora ──
  await printFinalSummary(apartmentId);
}

main().catch((e) => { console.error('\n✖ Erro fatal:', e.message); process.exitCode = 1; });
