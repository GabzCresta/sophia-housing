import pg from 'pg';
import path from 'node:path';
process.loadEnvFile(path.resolve('.env'));
const { runRouter } = await import('./scripts/router.js');

const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();

// 1) marco temporal ANTES da re-descoberta (relógio do próprio Postgres)
const T0 = (await c.query('select now() as t')).rows[0].t;
const before = (await c.query(`select count(*)::int n from places where category='supermarket'`)).rows[0].n;
console.log(`⏱  T0=${T0.toISOString()} · supermarket antes: ${before}`);

// 2) re-descobre supermarket p/ TODOS os apês (config já corrigido → só type 'supermarket')
console.log('\n───────── re-rodando router --category=supermarket ─────────');
await runRouter({ onlyCategory: 'supermarket' });

// 3) PREVIEW do que será deletado: supermarket não-tocados nesta rodada e não-selecionados
const doomed = (await c.query(
  `select p.id, p.name,
          (select count(*) from routes r where r.place_id=p.id)::int as rotas
     from places p
    where p.category='supermarket' and p.is_manual=false
      and p.updated_at < $1
      and p.id not in (select place_id from apartment_selections)
    order by p.name`, [T0])).rows;
console.log(`\n🗑  Mercearias a remover (não são supermarket real, não selecionadas): ${doomed.length}`);
console.table(doomed.map(d => ({ name: d.name.slice(0,44), rotas: d.rotas })));

// salvaguarda: se algo selecionado por acaso caísse na rede, não deletaria (cláusula acima já protege)
const del = await c.query(
  `delete from places
     where category='supermarket' and is_manual=false
       and updated_at < $1
       and id not in (select place_id from apartment_selections)
   returning id`, [T0]);
console.log(`\n✅ Removidos ${del.rowCount} places (cascade levou rotas/supermarket_details/seleções órfãs)`);

const after = (await c.query(`select count(*)::int n from places where category='supermarket'`)).rows[0].n;
console.log(`   supermarket depois: ${after}`);
await c.end();
