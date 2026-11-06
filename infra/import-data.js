// Load ./db-export/data.sql into the local daily-meat-db container (same as infra/import-data.sh, but runs on
// Windows too: no `sh` needed). Run the migrations first so the tables exist.
// Existing rows are removed first so the import can be repeated: it makes the local copy match the export exactly.
//
//   npm run db:up && npm run db:migrate && npm run db:import
//
// On the production server (container daily-meat-db-1, user daily_meat):
//   DB_CONTAINER=daily-meat-db-1 DB_USER=daily_meat node infra/import-data.js
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const container = process.env.DB_CONTAINER || 'daily-meat-db';
const db = process.env.DB_NAME || 'daily_meat';
const user = process.env.DB_USER || 'postgres';
const file = path.join(root, 'db-export', 'data.sql');

if (!fs.existsSync(file)) {
  console.error('db-export/data.sql not found - run: npm run db:export');
  process.exit(1);
}

const psqlArgs = ['exec', '-i', container, 'psql', '-U', user, '-d', db, '-q', '-v', 'ON_ERROR_STOP=1'];

// run psql in the container; `input` is piped to stdin, `extra` are extra psql arguments
const psql = (extra = [], input = undefined) => {
  const r = spawnSync('docker', [...psqlArgs, ...extra], { input, encoding: 'utf8', maxBuffer: 1024 * 1024 * 512 });
  if (r.error) {
    console.error(`could not run docker: ${r.error.message}`);
    process.exit(1);
  }
  return r;
};
const fail = (r, what) => {
  console.error(`${what} failed:\n${(r.stderr || r.stdout || '').trim()}`);
  process.exit(1);
};

// empty every app table (not the migration bookkeeping table)
let r = psql(['-At', '-c', `select string_agg(format('%I', tablename), ', ') from pg_tables where schemaname='public' and tablename <> 'SequelizeMeta'`]);
if (r.status !== 0) fail(r, 'listing tables');
const tables = r.stdout.trim();
if (tables) {
  r = psql(['-c', `TRUNCATE ${tables} RESTART IDENTITY CASCADE`]);
  if (r.status !== 0) fail(r, 'emptying tables');
}

console.log('importing db-export/data.sql ...');
r = psql(['--single-transaction'], fs.readFileSync(file));
if (r.status !== 0) fail(r, 'import');

console.log('row counts:');
r = psql(['-At', '-c', `select relname || ': ' || n_live_tup from pg_stat_user_tables where relname <> 'SequelizeMeta' order by relname`]);
if (r.status === 0) console.log(r.stdout.trim());
r = psql(['-At', '-c', `select 'users: ' || count(*) from users`]);
if (r.status === 0) console.log(r.stdout.trim());
console.log('done. Point the backend at it with DATABASE_URL=postgres://postgres:postgres@localhost:5433/daily_meat (see .env.local.example)');
