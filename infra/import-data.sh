#!/bin/sh
# Load ./db-export/data.sql into the local daily-meat-db container. Run the migrations first so the tables exist.
# Existing rows are removed first so the import can be repeated: it makes the local copy match the export exactly.
#
#   npm run db:up && npm run db:migrate && npm run db:import
#
# On the production server (container daily-meat-db-1, user daily_meat):
#   DB_CONTAINER=daily-meat-db-1 DB_USER=daily_meat sh infra/import-data.sh
set -eu
cd "$(dirname "$0")/.."

CONTAINER="${DB_CONTAINER:-daily-meat-db}"
DB="${DB_NAME:-daily_meat}"
DB_USER="${DB_USER:-postgres}"
FILE=db-export/data.sql
[ -f "$FILE" ] || { echo "$FILE not found - run: npm run db:export"; exit 1; }

PSQL="docker exec -i $CONTAINER psql -U "$DB_USER" -d $DB -q -v ON_ERROR_STOP=1"

# empty every app table (not the migration bookkeeping table)
TABLES=$($PSQL -At -c "select string_agg(format('%I', tablename), ', ') from pg_tables where schemaname='public' and tablename <> 'SequelizeMeta'")
[ -n "$TABLES" ] && [ "$TABLES" != "" ] && $PSQL -c "TRUNCATE $TABLES RESTART IDENTITY CASCADE"

echo "importing $FILE ..."
$PSQL --single-transaction < "$FILE"

echo "row counts:"
$PSQL -At -c "select relname || ': ' || n_live_tup from pg_stat_user_tables where relname <> 'SequelizeMeta' order by relname" || true
$PSQL -At -c "select 'users: ' || count(*) from users" || true
echo "done. Point the backend at it with DATABASE_URL=postgres://postgres:postgres@localhost:5433/daily_meat (see .env.example)"
