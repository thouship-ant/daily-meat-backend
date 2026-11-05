#!/bin/sh
# Daily database backup (cron: 0 2 * * * /path/to/infra/backup.sh). Copy BACKUP_DIR off the server too.
#   Restore: docker compose -f docker-compose.prod.yml --env-file .env exec -T db pg_restore -U daily_meat -d daily_meat --clean --if-exists < db-XXXX.dump
set -eu
cd "$(dirname "$0")/.."
DEST="${BACKUP_DIR:-/var/backups/daily-meat}"
mkdir -p "$DEST"
docker compose -f docker-compose.prod.yml --env-file .env exec -T db pg_dump -U daily_meat -Fc daily_meat > "$DEST/db-$(date +%F_%H%M).dump"
find "$DEST" -type f -name 'db-*.dump' -mtime +35 -delete
