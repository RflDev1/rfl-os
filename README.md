# Realm Fighting League V2

RFL is a dark, premium online fighting league where players watch fights, use
virtual Crowns, play casino games, collect cards, trade, and compete.

The product blueprint and implementation decisions are documented in
[docs/V2_BLUEPRINT.md](docs/V2_BLUEPRINT.md).

## Current phase

**Launch readiness.** The planned V1 feature roadmap is complete.
Operators now have a unified Today view for live events, attention queues,
database health, Crown supply, platform activity, and recent admin actions. The
control center includes event, betting, card, marketplace, request, economy,
ranking, user, role, suspension, audit, and read-only production-setting tools.
High-impact identity and moderation changes require explicit confirmation and a
meaningful reason, preserve self-lockout safeguards, and create immutable audits.
Production deployment, security, backup/restore, and launch procedures are now
documented and covered by automated browser smoke tests.

## Local setup

Requirements: Node.js 22–24, npm, PostgreSQL, and a Discord OAuth application.

1. Copy `.env.example` to `.env` and replace every example with this environment's
   values. Set `APP_URL` to the exact origin used in the browser.
2. Register `${APP_URL}/api/auth/callback/discord` as the Discord redirect URL.
   Set `BOOTSTRAP_ADMIN_DISCORD_ID` to the Discord ID of the initial operator;
   the exact matching account receives the first admin role when it links.
3. Start PostgreSQL directly or with `docker compose up -d postgres`.
4. Run `npm ci`, `npm run db:deploy`, then `npm run dev`.

The app refuses invalid environment configuration. Never commit `.env` files or
reuse staging/production OAuth applications, databases, or secrets locally.

## Verification

- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run test:integration`
- `npm run test:e2e`
- `npm run build`

## Production operations

- [Deployment runbook](docs/DEPLOYMENT.md)
- [Backup and restore runbook](docs/BACKUP_RESTORE.md)
- [Security runbook](docs/SECURITY.md)
- [Launch checklist](docs/LAUNCH_CHECKLIST.md)

## Non-negotiable product rules

- The public product is a game platform, not an admin dashboard.
- Crowns have no cash value and can never be redeemed for money.
- One feature is completed vertically before the next feature begins.
- Simple, explicit code is preferred over generic frameworks and abstractions.
- Player-facing language describes actions, never database concepts.
- Admin tools remain visually and structurally separate from the player app.
- Production targets DigitalOcean App Platform with DigitalOcean Managed
  PostgreSQL, a custom domain, managed HTTPS, and environment-only configuration.
