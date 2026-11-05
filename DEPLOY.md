# Deploying Daily Meat backend with Docker Compose (production)

Stack on one server: **Caddy** (HTTPS, the only public ports 80/443) -> **api** (Node/Express + socket.io, port 5100 internal) -> **PostgreSQL 17** (internal only, data in the `pgdata` volume).

Files: `docker-compose.prod.yml`, `Dockerfile`, `infra/Caddyfile`, `infra/deploy.sh`, `infra/backup.sh`. Configuration lives in a single `.env` file on the server (never committed).

## 1. Server prerequisites

- Ubuntu 22.04/24.04 VPS, 2 vCPU / 2 GB RAM or more.
- A domain (for example `dailymeatserver.devmetsolutions.com`) with an **A record** pointing at the server IP. Ports 80 and 443 must be open.

```bash
apt update && apt -y upgrade
apt -y install ca-certificates curl git ufw
timedatectl set-timezone Asia/Kolkata
ufw allow OpenSSH && ufw allow 80/tcp && ufw allow 443/tcp && ufw --force enable
curl -fsSL https://get.docker.com | sh
```

The database is never published, so no firewall rule is needed for 5432.

## 2. Get the code and configure

```bash
git clone <your-repo-url> ~/daily-meat-backend && cd ~/daily-meat-backend
nano .env
chmod 600 .env
```

`docker-compose.prod.yml` reads these from `.env`:

| Variable | Notes |
|---|---|
| `APP_BASE_URL` | Public URL, e.g. `https://dailymeatserver.devmetsolutions.com` (must be `https://` + host, no trailing slash or path); Caddy gets its HTTPS certificate for that host |
| `DATABASE_URL` | The single database setting, see below |
| `JWT_SECRET`, `REFRESH_TOKEN_SECRET` | Required. `openssl rand -hex 32` |
| `JWT_EXPIRES_IN`, `REFRESH_TOKEN_EXPIRES_IN` | Optional (default `1h` / `30d`) |
| `CASHFREE_*`, `SMS_FORTIUS_*`, `SMTP_*` | Same values as the current production |
| `STORAGE_PROVIDER` + `CLOUDINARY_*` or `AWS_*` | Image storage (no uploads volume is needed) |
| `EXPO_ACCESS_TOKEN`, `PLAY_STORE_URL`, `APP_STORE_URL`, `APP_ANDROID_*`, `APP_IOS_*` | Push and app-update notices |

### DATABASE_URL

One variable sets everything: the Postgres container is created with this user, password and database name, and the API connects with it (host must stay `db`).

```
DATABASE_URL=postgres://daily_meat:DevAIEnt%233781%24@db:5432/daily_meat
```

The password goes in the URL **percent-encoded**: `#` = `%23`, `$` = `%24`, `@` = `%40`, `:` = `%3A`, `/` = `%2F`, `%` = `%25`. The example above is the password `Dev#3781$`. The database container and the API both decode it back.

The user and password are applied only when the `pgdata` volume is **first created**. Changing `DATABASE_URL` later does not change an existing database; either `ALTER USER daily_meat PASSWORD '...'` inside it, or wipe the volume (`down -v`, deletes all data).

## 3. First deploy

```bash
C="docker compose -f docker-compose.prod.yml --env-file .env"

$C build
$C up -d db                          # creates the database
$C run --rm migrate                  # creates the tables (Sequelize migrations)
$C up -d                             # starts api + caddy
$C run --rm tools npm run setup:admin   # first admin account
```

Check:

```bash
$C ps                                # db and api should be "healthy"
$C logs -f api
curl https://YOUR_DOMAIN/api/health
```

Then point the mobile app's `BASE_URL` (`src/api/apiClient.ts`) at `https://YOUR_DOMAIN/api` and release a build.

## 4. Moving existing data from Supabase (optional)

Skip if starting fresh. `db-export/data.sql` is created by `npm run db:export` against the current database. After the migrations in step 3:

```bash
docker compose -f docker-compose.prod.yml --env-file .env exec -T db \
  psql -U daily_meat -d daily_meat -v ON_ERROR_STOP=1 --single-transaction < db-export/data.sql
```

Do this before the app takes real traffic, and re-export right before switching so no orders are lost.

## 5. Updating

```bash
./infra/deploy.sh
```

It pulls the code, rebuilds, starts the database, applies new migrations, and restarts the API. Add new migrations with `npm run db:migrate:create`; never rely on `sync` in production.

## 6. Backups

```bash
chmod +x infra/backup.sh
crontab -e
0 2 * * * /home/deploy/daily-meat-backend/infra/backup.sh
```

Dumps go to `/var/backups/daily-meat` (override with `BACKUP_DIR`) and are kept 35 days. Copy them off the server too (rclone/rsync).

Restore into a running db:

```bash
docker compose -f docker-compose.prod.yml --env-file .env exec -T db \
  pg_restore -U daily_meat -d daily_meat --clean --if-exists < db-XXXX.dump
```

## 7. Operations

```bash
$C logs -f api                       # API logs
$C restart api
$C exec db psql -U daily_meat -d daily_meat    # SQL shell
$C down                              # stop (data kept)
```

- **Cron jobs** (reminders, slot alerts, 7 PM / 10 PM tomorrow-plan) run inside the `api` container in IST (`TZ=Asia/Kolkata`). Run only **one** api container, or each reminder is sent twice.
- **Slow or stuck:** `$C ps` for health, `$C logs --tail 100 api`. For slow queries, run `src/scripts/addPerformanceIndexes.sql` once against the database.
- **HTTPS fails to issue:** the DNS A record must point at this server and ports 80/443 must be reachable; see `$C logs caddy`.
