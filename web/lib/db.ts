import { Pool, types } from "pg";

// NUMERIC (oid 1700) volta como string no node-pg (preserva precisão). Como aqui são
// valores monetários/índices exibidos, converto para número já na borda do banco.
types.setTypeParser(1700, (v) => (v === null ? null : parseFloat(v)));

// Pool único, cacheado no globalThis para sobreviver ao HMR do Next em dev.
const globalForPg = globalThis as unknown as { pgPool?: Pool };

export const pool =
  globalForPg.pgPool ??
  new Pool({ connectionString: process.env.DATABASE_URL, max: 5 });

if (process.env.NODE_ENV !== "production") globalForPg.pgPool = pool;

/** Executa uma query e devolve as linhas já tipadas. */
export async function query<T>(text: string, params?: unknown[]): Promise<T[]> {
  const res = await pool.query(text, params);
  return res.rows as T[];
}

/** Primeira linha ou null. */
export async function queryOne<T>(text: string, params?: unknown[]): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

/** Lê chaves de `settings` como objeto { key: value }. */
export async function getSettings(keys: string[]): Promise<Record<string, string | null>> {
  const rows = await query<{ key: string; value: string | null }>(
    `select key, value from settings where key = any($1)`,
    [keys],
  );
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

/** Upsert de uma chave em `settings` (key é primary key). */
export async function setSetting(key: string, value: string): Promise<void> {
  await query(
    `insert into settings (key, value) values ($1, $2)
       on conflict (key) do update set value = excluded.value, updated_at = now()`,
    [key, value],
  );
}
