# PlayRFL Pre-Launch Legal and Technical Gaps

Review date: July 29, 2026

This report compares the inspected repository with the accompanying legal drafts. It is not a certification of compliance or a penetration test.

## 1. Launch blockers

### 1.1. Identify the legal operator

The repository does not identify the operating person or entity, mailing address, or Texas venue county. `PlayRflHelp@gmail.com` is now identified as the general, privacy, appeals, and copyright contact. The Terms and DMCA formalities cannot be completed responsibly without the remaining facts.

Action: form or identify the operator; preferably move the monitored Gmail contact to a domain-based address; determine a lawful service/business address; and have Texas counsel confirm venue, liability, minor, and contest provisions.

### 1.2. Patch known dependency vulnerabilities

The latest inspected production audit reported 11 findings: 2 critical, 5 high, and 4 moderate. It identified critical Auth.js/NextAuth issues and high-severity Next.js issues, with patched versions available.

Action: update and test Auth.js and Next.js before launch, rerun `npm audit --omit=dev`, and establish automated dependency monitoring.

### 1.3. Enforce age restrictions

The Service now stores a self-reported birth date, rejects onboarding below age 13, and blocks accounts reporting an age under 18 from Wagering Features in navigation, pages, and server-side wager actions. It still performs no independent identity, age, or location verification.

Action: either disable Wagering Features for public launch or implement a defensible age gate, guardian flow for general minor use, server-side authorization, and a documented response to false information. Consider launching the entire Service 18+ after counsel reviews the Minecraft audience and state law.

The FTC explains that general-audience services with actual knowledge of collecting from a child under 13 can trigger COPPA duties, including parental notice/consent, access/deletion, security, and retention controls: [FTC COPPA guidance](https://www.ftc.gov/business-guidance/resources/childrens-online-privacy-protection-rule-not-just-kids-sites).

### 1.4. Build privacy-request operations

There is no self-service or staff workflow for access, correction, deletion, portability, request verification, authorized agents, denial, or appeal. The testing reset is broad and is not an individual privacy tool.

Action: create a monitored request channel, identity-verification procedure, response log, statutory deadline tracking, export format, deletion/de-identification procedure, exception checklist, and appeal route. Then add appropriate user-facing tools.

Texas law can require consumer access, correction, deletion, portability, opt-out, notice, and appeal mechanisms when it applies. The Texas Attorney General summarizes those obligations here: [Texas Data Privacy and Security Act](https://www.texasattorneygeneral.gov/consumer-protection/file-consumer-complaint/consumer-privacy-rights/texas-data-privacy-and-security-act). California applicability depends on statutory thresholds: [California Civil Code § 1798.140](https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=1798.140).

### 1.5. Add legal assent and version records

Terms, Privacy, and Responsible Play pages are integrated in the footer. Legal onboarding records the current Terms/Privacy versions and acceptance timestamps and retains acceptance-history rows. The drafts still require the operator’s legal identity and venue details before being represented as final.

Action: publish accessible routes and footer links; require affirmative assent at first account completion and after material changes; store document, version, timestamp, user, and appropriate request metadata; keep immutable policy versions.

### 1.6. Complete and register the DMCA agent

RFL currently provides only `PlayRflHelp@gmail.com` for copyright notices and has no designated agent, agent phone/address, provider street address, or Copyright Office registration. To seek 17 U.S.C. § 512(c) protection, the public designation must be matched by a current Copyright Office registration. The Office requires the provider’s full legal name and physical street address and the agent’s name or role, mailing address, phone, and email. See the [Copyright Office DMCA FAQ](https://www.copyright.gov/dmca-directory/faq.html).

### 1.7. Replace testing-grade data operations

The DigitalOcean app specification labels the attached PostgreSQL database `production: false`, and project documentation says production backup/restore is not yet verified. An owner-only reset can delete nearly all user, economy, Fighter, Match, and audit data in one operation while retaining Cards/artwork.

Action: use a production database plan with verified automated backups and point-in-time recovery; perform a restore drill; require step-up authentication plus a second approver or out-of-band confirmation for resets; disable the reset in production or restrict it to disposable environments; export a backup before any permitted reset.

## 2. High-priority gaps

### 2.1. Retention schedule

No automated retention or deletion schedule exists for sessions, OAuth account links, gameplay, notification failures, idempotency keys, rate limits, or audit records.

Action: adopt a data inventory with a justified period for each model, implement expiry jobs where appropriate, preserve litigation/security holds, and document backup deletion behavior. COPPA and general data-minimization principles make indefinite retention particularly risky.

### 2.2. Security program

The code has meaningful controls—OAuth, server-side roles, HTTPS, security headers, signed Discord interactions, transactional economy operations, rate limits, secrets in environment variables, audit records, and a non-root container. It lacks a documented incident-response plan, formal access review, separate MFA requirement for administrators, user session management, and field-level encryption.

Action: require Discord MFA for privileged users, minimize administrators, review access quarterly, rotate secrets, add alerting, create an incident/breach runbook, test recovery, and document vendors. The FTC stresses that businesses should honor privacy promises and maintain security appropriate to the data: [FTC privacy and security guidance](https://www.ftc.gov/business-guidance/privacy-security).

### 2.3. Discord token and documentation mismatch

The implementation requests `identify guilds.join`; `docs/SECURITY.md` says only `identify`. The implementation clears OAuth tokens after linking, which is good, but mandatory server joining must be clearly disclosed before authorization.

Action: correct technical documentation and ensure the sign-in screen explains the exact scopes and mandatory join.

### 2.4. Responsible-play controls

Wager ranges and rate limits exist, but there is no self-exclusion, cooling-off, personal limit, age/location check, or user-facing responsible-play summary.

Action: disable wagering for minors; add a one-click block/cooling period; add activity summaries and personal limits; allow staff to apply a durable restriction that alternate accounts cannot trivially evade.

### 2.5. Account lifecycle

Suspension/deactivation exists, but there is no user-initiated account closure, session/device revocation page, or automated disconnect from Discord. Fighter removal archives the historical profile and resets reactivated users to a new active record/rank.

Action: define closure versus historical-record preservation; revoke sessions; unlink Discord where lawful; disclose what remains public; prevent deleted display names from remaining unnecessarily in Marketplace/history.

### 2.6. Public-data controls

Fighter records and seller display names are public by design. There is no privacy review for a minor Fighter, pseudonym change history, or safety suppression.

Action: use aliases by default, prohibit real-name requirements, add a safety takedown route, and let authorized staff hide a Fighter page while preserving nonpublic integrity records.

## 3. Product-accuracy findings

- “Contracts” are not implemented and must not appear in published policies as a feature.
- There is no general feature-flag framework.
- Live updates use Server-Sent Events with two-second database polling and fallback state polling, not WebSockets.
- “Notifications” currently means Discord direct messages for fight approvals/reminders; there is no on-site notification center.
- The Discord application uses HTTP interactions and is not a continuously connected gateway bot; its Discord presence can appear offline.
- The Marketplace currently charges a zero fee.
- Crowns currently cannot be purchased, redeemed, or withdrawn.
- Ordinary users do not upload Card art; administrators do.
- Prisma is an application library, not a standalone hosting recipient.

## 4. Policies and product operations still needed

1. Put the legal documents at stable website routes and link them in the footer, sign-in, profile completion, Marketplace, packs, and Wagering Features.
2. Add a clear pack probability/supply disclosure based on the current published drop table.
3. Display current payout rules before each casino wager and accepted odds before each Match bet.
4. Create a moderation evidence and appeal procedure.
5. Create an intellectual-property intake log and register the DMCA agent.
6. Create a vendor register for Discord and DigitalOcean and execute/review appropriate data-processing terms.
7. Decide supported countries; block or warn unsupported regions until international privacy and gaming analysis is complete.
8. Review Minecraft/Mojang usage guidelines and all Card artwork, fighter likenesses, sponsors, and partner claims for licenses.
9. Add an incident contact, security disclosure procedure, uptime monitoring, log redaction review, and tested recovery objectives.
10. Re-review all policies whenever payments, Crown purchases, cash prizes, subscriptions, user uploads, direct messages, analytics, ads, a Minecraft server, or mobile apps are introduced.

## 5. Cookie conclusion

A separate Cookie Policy is included because authentication depends on cookies and users should understand that. The current code shows only necessary authentication/OAuth cookies and no analytics or advertising tags. Do not add an unnecessary consent banner that falsely implies optional tracking; do add a consent manager before any nonessential tracking where law requires it.

## 6. Attorney review questions

Counsel should confirm:

- the operator entity, Texas venue, and insurance;
- whether the entire Service or only Wagering Features should be 18+;
- state-by-state treatment of virtual-currency chance games and Match betting even without cash value;
- tournament rules, prizes, eligibility, sanctions, and official Match rules;
- rights to RFL and Card artwork, fighter names/likenesses, sponsor marks, and Minecraft references;
- Texas and California privacy-law applicability based on actual scale and revenue; and
- whether any employment, contractor, volunteer, child-safety, tax, or prize-promotion rules apply to staff and Events.
