/**
 * Run a SQL migration against the Supabase Postgres database.
 *
 *   node scripts/run-migration.mjs [path/to/file.sql]
 *
 * Defaults to supabase/migrations/0001_core_schema.sql.
 *
 * Needs SUPABASE_DB_URL in .env.local - the full connection string from
 * Supabase > Settings > Database > Connection string > URI. That string
 * contains the database password, which is separate from the API keys and is
 * the only credential that can create tables.
 */

import pg from 'pg';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

async function loadEnv() {
  try {
    const raw = await readFile(path.resolve('.env.local'), 'utf8');
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim();
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // No .env.local - use the ambient environment instead.
  }
}

await loadEnv();

const connectionString = process.env.SUPABASE_DB_URL?.trim();

if (!connectionString) {
  console.error(
    '\nSUPABASE_DB_URL is not set in .env.local.\n\n' +
      'Get it from Supabase:\n' +
      '  Settings > Database > Connection string > URI\n' +
      'then add it to .env.local as:\n' +
      '  SUPABASE_DB_URL=postgresql://...\n'
  );
  process.exit(1);
}

const file = process.argv[2] ?? 'supabase/migrations/0001_core_schema.sql';
const sql = await readFile(path.resolve(file), 'utf8');

console.log(`Applying ${file} (${sql.split('\n').length} lines)...`);

const client = new pg.Client({
  connectionString,
  // Supabase terminates TLS at the pooler with its own certificate chain.
  ssl: { rejectUnauthorized: false },
});

try {
  await client.connect();
  await client.query(sql);
  console.log('Migration applied successfully.');

  const { rows } = await client.query(
    `select table_name
       from information_schema.tables
      where table_schema = 'public'
      order by table_name`
  );
  console.log(`\nTables now in the database (${rows.length}):`);
  for (const r of rows) console.log('  -', r.table_name);
} catch (err) {
  console.error('\nMigration failed:', err.message);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
