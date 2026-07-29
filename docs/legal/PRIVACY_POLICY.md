# PlayRFL Privacy Policy

Effective date: July 29, 2026  
Version: 1.0-draft

This Privacy Policy explains how **[RFL LEGAL ENTITY NAME — REQUIRED]** (“RFL,” “we,” “us,” or “our”) handles personal information through PlayRFL.com and Realm Fighting League (the “Service”).

## 1. Scope and Contact

RFL is responsible for the information described here, except where a third party processes information under its own terms.

Email: **PlayRflHelp@gmail.com**  
Mail: **RFL currently does not publish a mailing address.**

## 2. Information We Collect

### 2.1. Discord authentication

The Service requests Discord’s `identify` and `guilds.join` OAuth scopes. It receives or derives your Discord user ID, username, profile image information, provider account identifier, authorization result, and the authorization needed to add or confirm you in the official RFL server.

The data model can hold an email address, but RFL does not currently request Discord’s `email` scope, so login is not designed to collect your email.

OAuth access, refresh, and ID tokens are cleared from RFL’s database after account linking. A token necessarily may exist briefly in server memory while the callback and required server join complete. RFL never receives or stores your Discord password.

### 2.2. Profile and account

We store your RFL display name, profile completion time, self-reported birth date, current Terms and Privacy versions and acceptance timestamps, account role and status, Discord-linked identifier, profile image reference if supplied, database session records, and creation/update timestamps. We also retain an append-only record of each accepted Terms and Privacy version.

### 2.3. Fighters and competitions

For Fighters, we store roster names and nicknames, active/suspended/inactive status, rank, wins, losses, draws, fight requests, opponents, Events, times, Match states, results, updates, and related staff decisions.

### 2.4. Crowns and games

We store your Crown balance and ledger entries for rewards, adjustments, casino wagers and payouts, Match bets and settlements, packs, and Marketplace transactions.

Casino records include wagers, results, and state needed to verify and settle Coin Flip, Blackjack, and High-Low. Blackjack and High-Low records include dealt cards, stored deck state, actions or guesses, outcomes, and payouts.

### 2.5. Cards, packs, and Marketplace

We store Card ownership, serials, supply, pack openings, published drop-table snapshots, listing prices, buyer and seller identifiers, listing status, sale time, and ledger references. Card artwork is uploaded by authorized administrators and stored as binary data in PostgreSQL.

### 2.6. Discord notifications and support

We store the status of RFL-generated Discord messages, including fight approvals and 2-hour, 1-hour, and 10-minute reminders, plus delivery attempts and error summaries.

RFL can create private support-ticket channels. Discord handles and retains messages in those channels; RFL’s website database does not automatically copy their contents.

### 2.7. Administration and security

We store administrative audit records with the administrator, action, target, time, and limited JSON summary. We use idempotency keys, rate-limit records, transaction references, and failure information to prevent duplicates, investigate errors, and address abuse.

### 2.8. Technical information

The application processes request headers, session cookies, browser/device communications, and network information such as IP addresses while serving requests. The inspected schema has no dedicated IP-address, analytics, advertising, or device-fingerprint table. DigitalOcean may create operational network and request logs under its own practices.

## 3. Information Not Currently Collected

The Service is not designed to collect RFL passwords, payment-card or bank information, government IDs, precise location, contacts, biometrics, real-money deposits or withdrawals, advertising profiles, or public user-uploaded video/voice.

Do not send sensitive information in a display name, fight request, or ticket unless specifically requested for a legitimate support or legal need.

## 4. Uses

We use information to:

- authenticate users and maintain sessions;
- require membership in the official Discord server;
- operate profiles, wallets, Fighters, rankings, Events, and Matches;
- process Crown transactions, games, bets, packs, Cards, and Marketplace transfers;
- enforce rank and eligibility rules;
- synchronize Discord roles and send fight messages;
- operate Discord commands, channels, and tickets;
- provide administrative controls and audit trails;
- prevent duplicate activity, fraud, cheating, exploitation, and security abuse;
- diagnose outages and failed transactions;
- comply with law and protect people and rights; and
- maintain and improve the Service.

RFL does not currently sell personal information or share it for cross-context behavioral advertising.

## 5. Public Information

Public fighter pages may show name or nickname, rank, status, record, fight history, results, and scheduled opponents. Public Event and Match pages may show participants, timing, state, results, and updates.

Marketplace pages may show a seller’s RFL display name with a Card and Crown price. Internal IDs, wallet balances, OAuth tokens, and session tokens are not intentionally public. Ordinary user profiles and wallets are not designed as public pages.

## 6. Cookies and Sessions

RFL uses Auth.js cookies and database-backed sessions for sign-in and OAuth security. They are necessary to authenticate, protect sign-in, and maintain sessions. The current code has no advertising or analytics cookies. See the [Cookie Policy](./COOKIE_POLICY.md).

## 7. Disclosures

We may disclose information:

- to DigitalOcean for hosting, networking, managed PostgreSQL, logging, and infrastructure;
- to Discord for OAuth, membership, roles, interactions, messages, and support channels;
- to personnel or contractors who need it to operate or secure RFL;
- when required by law or legal process;
- to protect safety, rights, security, or Match integrity;
- with a merger, financing, acquisition, reorganization, bankruptcy, or transfer; or
- at your direction or with consent.

Prisma is the database toolkit used to communicate with PostgreSQL; it is not a separate destination to which RFL intentionally sends a copy of user data.

## 8. Administrative Access

Authorized administrators can access data needed for assigned sections. Depending on role, this includes user display names and IDs, any stored email, account status and roles, Fighter linkage, Crown balances and ledgers, bets, games, packs, Marketplace participants, notification failures, and audits.

The Fighter Analyst role is limited by the application to content, Events, rankings, betting, and fight requests. Owner-only testing controls have broader destructive access. Controls reduce but cannot eliminate misuse risk.

## 9. Security

The current implementation uses Discord OAuth instead of RFL passwords, database sessions, server-side authorization, production HTTPS, HSTS and Content Security Policy headers, environment-variable secrets, signed Discord interaction verification, transactional wallet/ownership changes, idempotency controls, advisory locks, rate limits, audit records, and a non-root production container.

OAuth tokens are removed from the database after linking. Administrator Card uploads reject SVG and accept only JPEG, PNG, or WebP up to 5 MB.

RFL does not currently implement database field-level encryption, separate multi-factor authentication, a session/device manager, or a documented incident-response program. No system is completely secure.

## 10. Retention, Deletion, and Export

RFL has no automated retention schedule. Account, Fighter, Match, Crown, casino, Card, Marketplace, notification, and audit records remain while needed to operate, preserve transaction and Match integrity, resolve disputes, prevent abuse, or meet legal obligations.

There is no self-service account deletion, privacy-request, or data-export feature. An owner-only testing reset is not an individual deletion tool: it deletes broad data categories while preserving the owner and Card catalog/artwork.

You may request access, correction, deletion, or export at **PlayRflHelp@gmail.com**. Because no completed workflow exists, valid requests must be verified, documented, and fulfilled manually. Some records may be retained or de-identified for integrity, disputes, security, law, or another user’s records. Request Discord-held data from Discord.

## 11. Children and Age

The Service is not directed to children under 13, and they may not use it. RFL does not knowingly collect their information.

Users must be 18 and of legal majority to use Wagering Features. The current code collects a self-reported birth date and blocks accounts reporting an age under 18 from those features in both page access and server-side wager actions. RFL does not independently verify age or government identification. Report a child’s information to **PlayRflHelp@gmail.com**.

## 12. U.S. State Disclosures

RFL does not currently sell personal information, use it for targeted advertising, or disclose it for another company’s direct marketing.

Depending on RFL’s size and exemptions, Texas, California, or other law may give eligible residents rights to access, correct, delete, obtain a portable copy, or opt out of certain processing. RFL does not represent that every statute applies.

Where applicable, submit requests to **PlayRflHelp@gmail.com**. No automated request or appeal interface exists; RFL must establish a verified manual process before launch. RFL may request information needed to verify you and may deny or limit requests where law permits.

California residents may request information about third-party direct-marketing disclosures. RFL currently makes none.

## 13. International Users

RFL operates from the United States. Information is processed there and laws may differ from your country. The repository has no region-specific consent manager, EU/UK representative, or formal international-transfer program. Users outside the United States should not use the Service until RFL confirms lawful availability in their location.

## 14. Third Parties

Discord and DigitalOcean have their own terms and practices. Minecraft services or independently operated servers may have separate terms. RFL does not control a third party merely by linking to it.

## 15. Changes and Versioning

We may update this Policy and will post a new version and date. We will provide reasonable notice and obtain consent where legally required for material changes to existing data use.

The current implementation records the Terms and Privacy versions and timestamps accepted during legal onboarding. Material revisions should increment these versions so the Service can require renewed acceptance.

## 16. Contact

**[RFL LEGAL ENTITY NAME — REQUIRED]**  
**PlayRflHelp@gmail.com**  
**RFL currently does not publish a mailing address.**
