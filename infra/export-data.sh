#!/bin/sh
# Export the Supabase database into ./db-export/ :
#   schema.sql  - tables, indexes, constraints (public schema only)
#   data.sql    - every row of every table (COPY format, loads in one go)
# Read-only on Supabase. Needs Docker (uses a postgres:17 container for pg_dump, so no local install is needed).
#
#   ./infra/export-data.sh
#   SUPABASE_DB_URL='postgresql://...' ./infra/export-data.sh      # override the URL
#
# The pooler's transaction port (6543) can't run pg_dump, so the URL from .env is switched to the session port 5432.
set -eu
cd "$(dirname "$0")/.."

OUT=db-export
mkdir -p "$OUT"

URL="${SUPABASE_DB_URL:-}"
if [ -z "$URL" ]; then
  URL=$(grep -E '^DATABASE_URL=' .env | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")
fi
[ -n "$URL" ] || { echo "No DATABASE_URL in .env and SUPABASE_DB_URL not set"; exit 1; }
URL=$(printf '%s' "$URL" | sed -E 's#(pooler\.supabase\.com):6543#\1:5432#')
case "$URL" in *sslmode=*) ;; *) URL="$URL$(case "$URL" in *\?*) printf '&';; *) printf '?';; esac)sslmode=require";; esac

dump() { MSYS_NO_PATHCONV=1 docker run --rm postgres:17 pg_dump "$URL" --schema=public --no-owner --no-privileges "$@"; }

echo "dumping schema ..."
dump --schema-only | sed '/^\\restrict /d;/^\\unrestrict /d' > "$OUT/schema.sql"

echo "dumping data ..."
dump --data-only --disable-triggers | sed '/^\\restrict /d;/^\\unrestrict /d' > "$OUT/data.sql"

echo "exported to $OUT/ (schema $(du -h "$OUT/schema.sql" | cut -f1), data $(du -h "$OUT/data.sql" | cut -f1))"
echo "next: npm run db:up && npm run db:migrate && npm run db:import"
