# Public launch checklist

## Code and infrastructure

- [ ] Upgrade the temporary App Platform development database to production Managed PostgreSQL.
- [ ] Change the fixed single-instance web plan if measured traffic requires horizontal scaling.
- [ ] Confirm the `RflDev1/rfl-os` repository, `nyc` region, and initial sizing in `.do/app.yaml`.
- [ ] Run `npm run deploy:check -- /absolute/path/to/production.env`.
- [ ] Provision separate staging and production Managed PostgreSQL clusters.
- [ ] Use a pooled database URL for web traffic and a direct private URL for migrations.
- [ ] Confirm PRE_DEPLOY migrations succeed from a fresh database.
- [ ] Confirm automatic backup retention and complete a timed restore exercise.
- [ ] Configure the custom domain, DNS, managed TLS, and canonical `APP_URL`.
- [ ] Confirm production card uploads resolve from Spaces and survive a redeploy.
- [ ] Configure deployment-failure, domain-failure, database, latency, and error alerts.
- [ ] Run the full verification suite against the release commit and staging.
- [ ] Load-test wallet, live-event, betting, pack, and marketplace transactions against production-sized infrastructure.

## Discord

- [ ] Create separate staging and production OAuth applications and bots.
- [ ] Register exact callback URLs and use only the `identify` OAuth scope.
- [ ] Verify bot server membership, direct-message permissions, and failed-delivery retries.
- [ ] Bootstrap the first admin, then remove `BOOTSTRAP_ADMIN_DISCORD_ID`.

## Product data

- [ ] Replace provisional branding and generated letter artwork with licensed final assets.
- [ ] Load verified fighters, accounts, ranks, events, odds, card sets, and pack tables.
- [ ] Have a second operator review Crown amounts, casino returns, odds, pack rates, and marketplace limits.
- [ ] Rehearse event start, market lock, result, settlement/void, and Discord scheduling workflows.

## External approvals — launch blockers

- [ ] Legal review approves operating regions, minimum age, virtual-Crown betting/casino classification, contest rules, privacy notice, and terms.
- [ ] Publish reviewed player rules, privacy notice, eligibility, responsible-play information, game fairness rules, pack probabilities, and marketplace policy.
- [ ] Confirm rights for the RFL name, logo, fighter likenesses, card art, fonts, music, streams, and promotional assets.
- [ ] Define support, abuse, privacy-request, incident-response, and account-recovery contacts and service levels.

Do not open public registration until every external launch blocker is resolved. The repository cannot decide legal eligibility, content rights, traffic geography, budget, or final production credentials.
