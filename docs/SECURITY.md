# Security operations

## Security boundaries

- Discord OAuth uses the minimal `identify` scope. OAuth access, refresh, and ID tokens are cleared after account linking.
- Sessions use database-backed, secure HTTP-only cookies through Auth.js.
- Player mutations require an active, completed account. Admin mutations recheck the database-backed admin role on the server.
- Crown and ownership changes use serializable PostgreSQL transactions, advisory locks, immutable ledger/sale records, and idempotency keys.
- Secrets are environment-owned and never displayed in the admin settings screen or written to logs.

## Response headers

The application sends HSTS, CSP, clickjacking, MIME-sniffing, referrer, permissions, and cross-origin isolation headers. Any future third-party script, image, analytics, stream, or storage origin requires a deliberate CSP change and security review.

## Operational response

1. Suspend affected accounts without deleting financial or ownership history.
2. Rotate compromised OAuth, bot, database, and session secrets independently.
3. Inspect the immutable admin audit trail and relevant entity IDs; do not export raw session tokens or full wallet histories into tickets.
4. Pause Crown-changing workflows during a suspected ledger or transaction-integrity incident.
5. Use compensating wallet entries for corrections. Never edit or delete ledger entries.

Report dependency and framework vulnerabilities through the private repository’s security channel. Do not include live credentials, Discord IDs, or personal data in public issues.
