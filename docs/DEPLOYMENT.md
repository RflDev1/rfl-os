# Production deployment runbook

Realm Fighting League targets DigitalOcean App Platform, DigitalOcean Managed PostgreSQL, and DigitalOcean Spaces Standard Storage. Staging and production must use separate databases, Discord applications, bot tokens, domains, buckets, and secrets.

> Current testing deployment: `.do/app.yaml` intentionally uses a $7 App
> Platform development database and the fixed 1 GB web plan. Public registration
> and production card uploads must remain disabled until the database is upgraded
> to Managed PostgreSQL and the `CARD_IMAGE_*` variables are backed by Spaces.

## Production topology

- One App Platform web service built from `Dockerfile`.
- One App Platform `PRE_DEPLOY` job built from `Dockerfile.migrate`.
- One same-region Managed PostgreSQL cluster. Use the pooled URL for `DATABASE_URL` and the direct URL for `DIRECT_DATABASE_URL`.
- One same-region Spaces Standard bucket for durable card artwork. The container filesystem is ephemeral and must never hold production uploads.

Start with one web instance. Add a second instance only after measuring real load and confirming the selected PostgreSQL connection pool can support it.

## One-time setup

1. Create a Managed PostgreSQL cluster in the same DigitalOcean region as the app. Attach it to the App Platform app as a trusted source. Use a connection-pool bindable URL for `DATABASE_URL` and the direct private bindable URL for `DIRECT_DATABASE_URL`; retain TLS in both.
2. Create staging and production Discord applications. Register the exact `${APP_URL}/api/auth/callback/discord` callback for each environment. Add the bot to the RFL Discord server and permit direct-message creation.
3. Create a DigitalOcean Spaces **Standard Storage** bucket for permanent card artwork, enable public reads/CDN delivery, create a bucket-scoped read/write/delete access key, and set the six `CARD_IMAGE_*` environment variables. Do not use Cold Storage for live artwork.
4. Connect DigitalOcean to the `RflDev1/rfl-os` GitHub repository, review the selected `nyc` region and initial instance sizes in `.do/app.yaml`, and create the app from the spec.
5. Set every environment variable listed in `.env.example`. The App Spec supplies the checked-in gameplay defaults; review them before launch. Generate independent random `AUTH_SECRET` values of at least 32 characters.
6. Keep a local, uncommitted production environment file and run `npm run deploy:check -- /absolute/path/to/production.env`. The check validates required values, HTTPS, TLS database URLs, Discord identifiers, Spaces configuration, and repository placeholders without printing secrets.
7. Set `BOOTSTRAP_ADMIN_DISCORD_ID` only for the initial operator. After that account receives the admin role, remove the value and redeploy.
8. Add the custom domain in App Platform, verify DNS, and wait for DigitalOcean’s managed TLS certificate before accepting users. Set `APP_URL` to that exact HTTPS origin without a trailing slash, then register `${APP_URL}/api/auth/callback/discord`.

The `database-migrate` PRE_DEPLOY job runs `prisma migrate deploy` before the new web image receives traffic. A migration failure must fail the deployment. This follows DigitalOcean’s current [pre-deploy job model](https://docs.digitalocean.com/products/app-platform/how-to/manage-jobs/) and [App Spec reference](https://docs.digitalocean.com/products/app-platform/reference/app-spec/).

## Release procedure

1. Run the production preflight, then `npm ci`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:integration`, `npm run test:e2e`, and `npm run build`.
2. Build the exact Docker image for the commit and test `/api/health/live` and `/api/health/ready` from it.
3. Deploy to staging. Confirm the migration job succeeded before smoke testing Discord login, Crown mutation, event updates, betting settlement, pack purchase, marketplace transfer, fighter-request approval, and Discord delivery.
4. Review additive migrations for backward compatibility. Never edit an already-applied migration.
5. Deploy the same commit/image to production during a monitored window.
6. Confirm readiness, authentication callback, admin Today view, error logs, and the attention queue.

## First-deploy smoke checks

1. Confirm `/api/health/live` returns HTTP 200 and `/api/health/ready` returns HTTP 200.
2. Sign in through Discord on the production domain and confirm the callback never redirects to the App Platform starter domain.
3. Upload a test card image and confirm its URL points to Spaces, not `/uploads`.
4. Create a zero-stakes test event workflow, approve a fighter request, and confirm the Discord notification.
5. Review deployment, runtime, migration-job, and database logs before enabling public registration.

## Rollback

Roll the web component back to the previous image. Do not automatically reverse database migrations. Every migration must be safe while the previous and new application versions may briefly overlap. If a schema correction is needed, ship a new forward migration.

## Scaling

The application stores no durable state on the container filesystem. Multiple web instances can share Managed PostgreSQL. Before scaling, load-test database connection capacity and set an appropriate connection limit/pool strategy for the selected cluster size.
