# Backup and restore runbook

DigitalOcean Managed PostgreSQL automatic backups and point-in-time recovery are the primary recovery mechanism. Confirm the retention window in the production cluster before launch; do not assume the provider default meets league requirements.

## Backup controls

- Keep the database and its provider-managed backups protected from routine app deletion.
- Restrict database credentials to the web service, migration job, and named operators.
- If retention beyond the managed window is required, schedule encrypted `pg_dump` exports to a separate restricted bucket and test their restoration.
- Record the database cluster, backup window, last restore exercise, recovery point objective, and recovery time objective in the private operations record.

## Quarterly restore exercise

1. Create an isolated restore-test database. Never restore over staging or production.
2. Restore a provider snapshot or point-in-time copy into that isolated target.
3. Set `DATABASE_URL` and `DIRECT_DATABASE_URL` only in the temporary verification environment.
4. Run `npm run db:deploy` to prove forward migrations remain applicable.
5. Verify wallet reconciliation, user/role counts, event/fight relationships, pending market state, card ownership, and audit records with read-only queries.
6. Start the application against the restored database and execute the smoke journeys.
7. Destroy the temporary environment after recording timing, gaps, and corrective actions.

## Incident restore

1. Stop Crown-spending and ownership-changing traffic before recovery.
2. Identify the incident timestamp and select the latest safe recovery point.
3. Restore to a new managed cluster rather than overwriting the damaged cluster.
4. Validate schema, ledger reconciliation, immutable sales, card ownership, and admin audit history.
5. Rotate database credentials, update the app environment, run readiness checks, and resume traffic.
6. Preserve the original cluster for investigation until the incident owner authorizes disposal.

Never use `prisma migrate reset`, destructive schema pushes, or ad-hoc ledger edits in production.
