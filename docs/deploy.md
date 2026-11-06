# Free demo deployment: Render + Neon

Temporary setup for pitches and a few trial customers. It costs nothing and needs no card. Do not add a card to either service, so that nothing can be billed.

| Part | Service | Free limit |
|---|---|---|
| App + API | Render free web service (`render.yaml`), Singapore | 750 hours a month; sleeps after 15 idle minutes, about a minute to wake |
| Database | Neon free plan, Postgres 16, Singapore | 1 GB storage, 100 CU-hours a month; compute stops until next month if used up |

Render says free instances are not for production. Move to paid plans before charging customers.

## Set up

1. **Neon:** create a project with Postgres 16 in `aws-ap-southeast-1`, and cap autoscaling at 0.25 CU.
2. **Connection address:** in **Connect**, turn **Connection pooling** off, so the host has no `-pooler`. The app sets its role through connection options, which the pooler does not support. Replace everything after `?` with `sslmode=verify-full`.
3. **Admin keys:** make one per founder, in the form `name:key,name:key`, with `openssl rand -hex 24` for each key.
4. **Render:** New → Blueprint → this repo, branch `deploy/demo`. Enter `DATABASE_URL` and `ADMIN_KEYS` when asked. Render generates `BUNKAR_SECRET`; keep it, because changing it logs everyone out.
5. **Check the deploy log** for `Row-level security mode: role`. Any other value means organisations are less strictly separated, so do not add customers until it is fixed.

Founders sign in at `/admin`. Keep admin keys out of chat and out of the repo.

## Demo data

```bash
cd server
SEED_ADMIN="name:key" BASE=https://<service>.onrender.com node seed-demo.mjs                 # carpet
SEED_ADMIN="name:key" BASE=https://<service>.onrender.com node seed-demo.mjs --industry bags # bags
```

Each run prints the unit code, key and PIN (1234). Keep these private. Organisations cannot be deleted in the console, so run this once.

## Back up and restore

Neon's free restore history is only 6 hours. Take a backup every week and before any risky change, and keep the files in a private folder. They contain wage and worker data. `pg_dump` must be version 16 or newer.

```bash
umask 077
export PGSSLROOTCERT=system   # psql, pg_dump and pg_restore need this for sslmode=verify-full
pg_dump "$DATABASE_URL" -Fc -f "bunkar-$(date +%F).dump"                                          # back up
pg_restore --no-owner --no-privileges -d "$TARGET_DATABASE_URL" bunkar-YYYY-MM-DD.dump            # restore
```

Restore into an empty database or a new Neon branch, never over live data without a fresh backup. Start the server on it once afterwards, because startup recreates the role and its permissions.

## Before a pitch

1. Open the site 2-3 minutes early, because it may be asleep.
2. Log in to the demo unit and check that it shows **synced**.
3. Check Neon usage: CU-hours and storage.
4. Have the phone's installed app open too, in case the venue's internet is poor.

## Limits to watch

- **Neon CU-hours:** each open phone syncs every 30 seconds and can keep the database awake. At 0.25 CU, 10 hours a day uses about 75 CU-hours a month. Act at 60.
- **Storage:** photos live in the database, at up to about 300 KB each.
- **Render:** a restart can happen at any time. If a monthly limit is reached, the service stops until the next month.

Tell trial customers this is a trial. Moving away from the `onrender.com` address later means phones must sync first and then rejoin, because offline data is stored per address.
