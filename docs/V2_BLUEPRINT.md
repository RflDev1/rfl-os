# RFL V2 Product and Technical Blueprint

**Status:** Approved starting proposal  
**Scope:** Product architecture only; no application code  
**Working principle:** Build the smallest complete product that feels excellent.

## 1. Product definition

RFL is an entertainment platform built around a loop:

1. See what is happening now.
2. Watch or follow a fight.
3. Make one clear choice: bet, play, collect, or trade.
4. Receive an immediate, satisfying result.
5. See progress and return for the next event or reward.

Every player page must strengthen that loop. A page that exists only to expose
data or internal structure does not belong in the player product.

### Success criteria

- A first-time visitor can identify the live event, wallet, casino, cards, and
  marketplace without instruction.
- A signed-in player can claim a daily reward or start Coin Flip in at most two
  intentional actions.
- A player can place a fight bet in four steps on one screen: pick, enter,
  review, confirm.
- Every Crown change is explainable, auditable, and safe under retries.
- Core flows work on a 360 px-wide screen, with keyboard navigation, screen
  readers, reduced motion, and 200% zoom.
- Player pages contain no admin terminology or technical controls.

### Explicit non-goals for the first release

- Real-money purchases, cash redemption, or Crown-to-currency conversion
- Crypto, NFTs, or external card ownership
- A generic workflow or event-processing platform
- Native mobile apps
- Microservices, a monorepo, or a reusable component package ecosystem
- Chat, forums, clans, tournaments, referrals, quests, or cosmetics
- User-to-user direct trades before the marketplace is proven
- Multiple casino rule variants or configurable game engines
- Public APIs or third-party integrations beyond Discord authentication

These can be reconsidered from evidence after the core loop is operating. They
must not shape today's architecture.

## 2. Architecture decisions

### Recommended stack

Use a **modular monolith**:

- **Web and server:** Next.js with TypeScript
- **Database:** PostgreSQL
- **Database access:** Prisma migrations and client
- **Authentication:** Auth.js with Discord OAuth
- **Validation:** Zod at every server boundary
- **Styling:** Tailwind CSS plus a small set of CSS design tokens
- **Motion:** Motion for React for choreographed UI; CSS transitions for simple
  hover, focus, and press feedback
- **Testing:** Vitest and Testing Library for units/components; Playwright for
  browser journeys; axe checks inside browser tests
- **Production hosting:** DigitalOcean App Platform, DigitalOcean Managed
  PostgreSQL, one DigitalOcean Spaces bucket for durable media, and one
  error-monitoring service

App Platform is the default production target. It keeps deployment, TLS, health
checks, runtime environment variables, and horizontal scaling managed while the
product remains one deployable application. A Droplet is a supported escape hatch,
not the initial choice: use it only if a measured App Platform limitation or cost
comparison justifies accepting operating-system patching, reverse-proxy upkeep,
certificate renewal, process supervision, and host security.

### Why a modular monolith

One application is the simplest reliable unit for authentication, server-rendered
pages, transactional Crown changes, casino results, and admin operations. Domain
folders keep ownership clear without introducing network calls or distributed
failure modes.

The important boundary is not a separate service. It is that all Crown-changing
operations go through one transaction-safe wallet module.

### Rejected alternatives

| Choice | Decision | Reason |
|---|---|---|
| Microservices | Reject | Adds deployment, networking, tracing, and consistency work with no player value. |
| Monorepo with many packages | Reject | There is one product and one deployable app. Package borders would be ceremony. |
| Separate REST backend | Reject initially | Duplicates schemas and auth plumbing. Server actions/route handlers cover current clients. |
| GraphQL | Reject | The product has focused screens, not arbitrary client queries. |
| Redux for all state | Reject | Most state belongs in the URL, server, or a local component. |
| Generic casino engine | Reject | Three finished games are simpler than one speculative framework. |
| Event sourcing | Reject | A normal relational model plus an immutable wallet ledger provides the auditability required. |
| WebSockets everywhere | Reject | Only live-event updates need realtime delivery; normal pages use request/response. |
| CMS at launch | Reject | Announcements and featured content can be controlled in the small admin area. |

## 3. Repository structure

Create this structure as features are implemented, not in advance:

```text
rfl/
├── README.md
├── docs/
│   ├── V2_BLUEPRINT.md
│   └── decisions/                 # only consequential ADRs
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
├── public/
│   ├── fighters/
│   ├── cards/
│   └── brand/
├── src/
│   ├── app/
│   │   ├── (public)/              # home, fighters, live events
│   │   ├── (player)/              # wallet, casino, cards, marketplace
│   │   ├── admin/                 # separate shell and authorization gate
│   │   ├── api/                   # OAuth callbacks, realtime, webhooks only
│   │   ├── layout.tsx
│   │   └── globals.css
│   ├── features/
│   │   ├── auth/
│   │   ├── home/
│   │   ├── wallet/
│   │   ├── coin-flip/
│   │   ├── blackjack/
│   │   ├── high-low/
│   │   ├── events/
│   │   ├── betting/
│   │   ├── cards/
│   │   ├── marketplace/
│   │   ├── fight-requests/
│   │   └── admin/
│   ├── components/                # truly shared visual primitives only
│   │   ├── ui/
│   │   └── layout/
│   ├── lib/                       # db, auth, env, logging, validation
│   └── test/                      # shared test setup and factories
├── tests/
│   └── e2e/
├── .do/
│   └── app.yaml                   # reviewable App Platform specification
├── .env.example                   # names and safe examples; never secrets
├── Dockerfile                     # production image and local parity
├── docker-compose.yml             # local PostgreSQL only
├── package.json
└── next.config.ts
```

### Feature folder rule

A feature owns its UI, server actions, queries, validation, domain functions,
and tests. A typical folder stays shallow:

```text
features/coin-flip/
├── coin-flip-screen.tsx
├── coin-flip.action.ts
├── coin-flip.logic.ts
├── coin-flip.schema.ts
└── coin-flip.test.ts
```

Do not create repositories, controllers, services, use-cases, DTOs, and mappers
for every feature. Add a boundary only when it protects an invariant, isolates
an external dependency, or removes demonstrated duplication.

## 4. UI architecture

### Player information architecture

**Desktop primary navigation:** Home, Live, Casino, Cards, Marketplace.  
**Persistent utilities:** Crown balance, notifications, profile menu.  
**Mobile bottom navigation:** Home, Live, Casino, Cards, Market.  
**Contextual actions:** Bets live inside a fight/event context; collection and
sell actions live inside Cards/Marketplace.

Do not place every feature in navigation. Daily reward appears as a clear home
action and a wallet notification. Fight requests live on the player's profile
or fighter context once shipped.

### Page shells

- **Public shell:** marketing-light header, event emphasis, sign-in action.
- **Player shell:** same visual world with wallet and personal utilities.
- **Live shell:** immersive, distraction-reduced event view.
- **Admin shell:** separate `/admin` route, neutral dense styling, role gate,
  clear warning that the user has left the player experience.

Admin must not share player navigation. Shared low-level components such as
Button and Dialog are acceptable; page layouts are not.

### Home composition

The home page is prioritized, not exhaustive:

1. Live event hero; if none is live, the next event hero
2. Featured fight with one primary action
3. Daily reward for signed-in players; sign-in invitation otherwise
4. Open bets tied to upcoming fights
5. Upcoming fights
6. Featured cards and marketplace highlights
7. One announcement strip

“Trending fighters” is introduced only when enough real activity exists to make
the ranking meaningful. Until then, use editorially featured fighters rather
than fake trend data.

### Interaction rules

- One visually dominant action per panel.
- Confirmation dialogs only for irreversible or Crown-spending actions.
- Optimistic UI is allowed for reversible preferences, never for Crown results.
- Crown values always show the Crown icon, grouped digits, and plain-language
  outcomes such as “You’ll spend 250 Crowns.”
- Errors appear beside the action with a recovery path; no raw codes.
- Empty states suggest the next enjoyable action.
- Loading uses stable skeleton geometry; avoid spinners for whole pages.

## 5. Design system

### Visual direction

The system uses near-black blue surfaces, warm ivory text, restrained royal
violet accents, and gold only for Crowns/rewards. Red and blue identify fight
corners; they are contextual colors, not global decoration.

### Foundation tokens

| Token | Starting value | Use |
|---|---:|---|
| `canvas` | `#080A0F` | App background |
| `surface-1` | `#10131B` | Cards and navigation |
| `surface-2` | `#171B25` | Raised panels |
| `text` | `#F6F3EA` | Primary text |
| `muted` | `#A5A8B3` | Secondary text; verify contrast |
| `violet` | `#8B6CFF` | Brand action and focus |
| `gold` | `#E8B84A` | Crowns and earned rewards only |
| `danger` | `#EF5A67` | Destructive/error states |
| `corner-red` | `#E5535F` | Red fighter context |
| `corner-blue` | `#4D7FF2` | Blue fighter context |

Use a 4 px spacing base, 12/16/24 px radii, thin translucent borders, and no
more than three elevation levels. Glass effects require an opaque fallback and
must not reduce text contrast.

### Typography

- One expressive display face for event headlines and fighter names.
- One highly legible sans-serif for navigation, body, controls, and numbers.
- Use tabular numerals for odds, countdowns, records, and Crown balances.
- Minimum body size is 16 px; secondary labels never substitute tiny text for
  hierarchy.

Font choices should be finalized after testing loading cost and the actual RFL
brand assets. Two families is the limit.

### Component set

Build components only when first needed:

- Button, IconButton, LinkButton
- Field, AmountField, Select, SegmentedControl
- Card, EventCard, FighterCard, CollectibleCard
- Dialog, Drawer, Toast, Tooltip
- Tabs, Badge, CrownAmount, Countdown
- Skeleton, EmptyState, InlineError

Domain components such as BetSlip, PlayingCard, and PackReveal stay with their
features. They must not be forced into a generic component library.

### Accessibility baseline

- WCAG 2.2 AA target
- Visible `:focus-visible` treatment on every interactive element
- 44 x 44 px minimum touch targets
- Semantic buttons, links, headings, dialogs, and live regions
- Color never carries meaning alone
- Casino outcomes are announced in text, not only animation or sound
- Sound is off by default until the player opts in; controls persist preference
- No autoplaying motion that blocks interaction

## 6. Animation system

Motion communicates cause, hierarchy, and reward. It is not ambient decoration.

### Motion tokens

| Name | Duration | Use |
|---|---:|---|
| Instant | 80–120 ms | Press and selection feedback |
| Quick | 160–200 ms | Hover, tabs, small state changes |
| Standard | 240–320 ms | Drawers, dialogs, page elements |
| Reward | 500–900 ms | Wins, pack reveals, Crown arrival |

Use one standard ease-out curve for entrances and an ease-in curve for exits.
Spring motion is reserved for tactile cards, chips, and coins. Never animate
layout in a way that moves the player's target.

### Required patterns

- Route change: subtle 8 px rise and fade for main content; shell stays fixed.
- Cards: slight elevation and border-light shift; no dramatic 3D tilt on touch.
- Bet confirmation: compact slip lock-in, then wallet balance updates after the
  server confirms.
- Coin Flip: result is determined server-side first; animation reveals that
  result and never determines it.
- Blackjack: sequential deal motion with a “Skip animation” path.
- Pack opening: staged reveal, tap/keyboard advance, and “Reveal all.”
- Crown reward: local particles travel toward the wallet, followed by a polite
  accessible balance announcement.

### Reduced motion

With `prefers-reduced-motion: reduce`, remove travel, parallax, flips, particles,
and count-up effects. Replace them with short crossfades or immediate state
changes. Game pace and access to results must remain identical.

## 7. State management strategy

Use the narrowest owner for every state:

1. **Database/server:** balances, bets, game rounds, inventory, listings,
   events, permissions, and results.
2. **URL:** filters, sort, selected marketplace category, event/fighter identity,
   and shareable tabs.
3. **Server-rendered data:** page content and initial personalized state.
4. **Local component state:** open dialogs, selected coin side, bet amount before
   submission, card hover/reveal state.
5. **Small context providers:** session-facing conveniences, sound preference,
   and temporary toast coordination only.

Do not add a global client store at the start. If later evidence shows complex
cross-route client state, document the concrete problem before selecting one.

Server responses are authoritative for all Crown-changing actions. Disable repeat
submission while pending, but also enforce idempotency on the server because UI
controls are not a financial invariant.

## 8. Database plan

PostgreSQL is the system of record. Use UUID/ULID-style identifiers, UTC
timestamps, foreign keys, unique constraints, and database transactions for
multi-row state changes. Store Crown amounts as integers; floats are forbidden.

### Identity and access

| Table | Purpose and key fields |
|---|---|
| `users` | Player identity, display name, avatar, status, created time |
| `accounts` | Auth.js provider account; Discord provider ID is unique |
| `sessions` | Database sessions when required by the selected Auth.js adapter |
| `user_roles` | Explicit `PLAYER`, `MODERATOR`, `ADMIN` grants |
| `user_preferences` | Sound, reduced data, notification preferences |

Do not store Discord access tokens unless a shipped feature needs Discord API
access after login. Login alone only needs stable identity and basic profile.

### Crowns

| Table | Purpose and key fields |
|---|---|
| `wallets` | One per user; cached current integer balance and version |
| `wallet_entries` | Immutable delta, balance-after, reason, reference type/ID, idempotency key, timestamp |
| `daily_reward_claims` | User, reward date, amount; unique per user/date |

`wallets.balance` makes reads cheap; `wallet_entries` makes every mutation
explainable. Both update inside the same database transaction. No feature may
write either table directly; it calls the wallet operation that locks/checks the
balance, inserts the unique ledger entry, and updates the cached balance.

Never edit or delete a ledger entry. Correct mistakes with a compensating entry.

### Casino

| Table | Purpose and key fields |
|---|---|
| `coin_flip_rounds` | User, choice, wager, result, payout, fairness data, status |
| `blackjack_rounds` | User, wager, dealer/player state, outcome, payout, status, version |
| `blackjack_actions` | Ordered hit/stand/double actions for dispute/debug history |
| `high_low_rounds` | User, wager, current card, step, multiplier, state, outcome |
| `high_low_guesses` | Ordered guess, revealed card, multiplier change |

Rules are versioned with a small integer on each round so an in-progress or
historic result remains interpretable after a deliberate rules change. Do not
build a generic games table; the games have different invariants.

Random outcomes are generated only on the server using a cryptographically secure
source. Before public launch, publish a plain-language fairness approach and
commission a security review of randomness, payout math, replay protection, and
race conditions.

### Events, fighters, and betting

| Table | Purpose and key fields |
|---|---|
| `fighters` | Name, nickname, portrait, bio, record display fields, active state |
| `events` | Title, venue/stream data, scheduled time, live status, hero assets |
| `fights` | Event, red fighter, blue fighter, order, state, scheduled time, result |
| `fight_updates` | Human-readable timeline updates for live viewers |
| `bet_markets` | One winner market per fight initially; open/lock/settled state |
| `bets` | User, market, chosen fighter, stake, displayed odds, possible payout, state |

The initial market is winner-only and fixed-odds. Odds edits affect new bets,
not accepted bets. A fight start locks its market. Settlement is idempotent and
records the admin actor. Voids return stakes through compensating wallet entries.

### Cards and marketplace

| Table | Purpose and key fields |
|---|---|
| `card_sets` | Named release and availability window |
| `card_definitions` | Fighter/card art, rarity, set number, metadata |
| `card_instances` | Unique owned copy, owner, definition, serial, acquired time |
| `pack_definitions` | Contents, price, published drop-table version |
| `pack_openings` | User, purchased pack, committed result, opened time |
| `market_listings` | Card instance, seller, integer price, active/sold/cancelled state |
| `market_sales` | Immutable buyer/seller/card/price/fee snapshot |

A card instance can have at most one active listing. Buying locks the listing and
wallet rows, checks buyer funds and seller ownership, transfers the card, moves
Crowns, and closes the listing in one transaction. Marketplace fees, if added,
are visible before confirmation and credited to a named system wallet.

Pack results are generated and committed on the server before the reveal
animation. Drop rates are versioned and displayed to players before purchase.

### Profiles, rewards, requests, and operations

| Table | Purpose and key fields |
|---|---|
| `achievements` / `user_achievements` | Defined awards and earned instances |
| `fight_requests` | Requester, opponent/context, message, state, timestamps |
| `announcements` | Short home announcement, schedule, active state |
| `notifications` | User, plain-language message, target, read time |
| `admin_audit_entries` | Actor, action, target, before/after summary, timestamp |

Ranks and fighter records should initially derive from settled fights. Add a
snapshot table only if measured query cost or historical ranking display needs it.

### Data lifecycle and safety

- Soft-disable users, events, fighters, and definitions referenced by history.
- Never cascade-delete financial, bet, game, sale, or admin-audit history.
- Back up production automatically and practice restoration before launch.
- Define retention for sessions, OAuth data, logs, and user deletion requests.
- Seed data is fictional and visibly separated from production operations.

## 9. API strategy

### Default communication

- Server Components query the database for reads.
- Server Actions handle authenticated first-party mutations from forms and game
  controls.
- Route Handlers exist only where an HTTP endpoint is genuinely required:
  OAuth callbacks, live update streams, health checks, and future webhooks.
- Use Server-Sent Events for one-way live fight updates. Add WebSockets only if
  a shipped feature later requires bidirectional low-latency communication.

### Mutation contract

Every mutation follows the same small contract:

1. Authenticate the session.
2. Authorize ownership/role.
3. Parse a Zod input schema.
4. Enforce rate and replay limits.
5. Execute a database transaction.
6. Return a typed success or a player-safe error.
7. Revalidate affected server data.

Crown-spending requests carry a client-generated idempotency key. The database
stores it under a unique constraint. Retrying returns the original outcome.

### Errors and observability

Player responses use stable categories such as `NOT_ENOUGH_CROWNS`,
`BETTING_CLOSED`, and `LISTING_UNAVAILABLE`, each mapped to helpful copy. Internal
logs include a request ID and entity IDs, never OAuth secrets or sensitive session
data. Monitor errors, latency, Crown invariant failures, and settlement failures.

## 10. Authentication and authorization

### Discord login flow

1. “Continue with Discord” starts OAuth with minimal scopes (`identify` and only
   any additional scope a shipped requirement proves necessary).
2. Callback creates or links an account by Discord provider ID.
3. New users choose/confirm a display name and accept the rules and privacy terms.
4. The server creates the user wallet exactly once.
5. A secure, HTTP-only, same-site cookie maintains the session.

Do not trust mutable Discord names for identity and do not automatically link
accounts solely by unverified/matching email. Account linking and recovery need
an explicit safe flow before adding another provider.

### Authorization

- Public routes are readable without login.
- Player mutations require an active user session.
- Admin routes check the database role on the server for every request/action.
- UI visibility is convenience, not security; hiding a button never authorizes
  its action.
- High-impact admin actions require re-confirmation, a reason, and an audit entry.
- Start with `PLAYER`, `MODERATOR`, and `ADMIN`; do not build a configurable
  permission matrix until real operational roles require it.

### Abuse controls

Apply server-side rate limits to OAuth attempts, daily claims, game creation and
actions, bet placement, listing purchase, fight requests, and admin mutations.
Detect impossible action speed, repeated idempotency misuse, and balance invariant
violations. Suspend gameplay separately from account access when appropriate.

## 11. Feature roadmap and development phases

Each phase is a release gate. Do not start the next player feature until the
current phase meets its definition of done. Small foundational work needed by the
current feature is part of that phase—not a separate platform project.

### Phase 0 — product foundation (current)

- Approve this blueprint and the Crown/economy rules.
- Confirm brand assets, content voice, age/eligibility rules, and operating regions.
- Wireframe home, player shell, wallet, and Coin Flip at mobile and desktop sizes.
- Define measurable launch targets and analytics events.
- Perform legal review of virtual currency, casino-style games, odds display,
  minors, privacy, contest rules, and Discord terms in every operating region.

**Exit:** Product decisions are explicit enough to build authentication without
inventing policy in code.

### Phase 1 — Discord login

- Public shell and responsive navigation
- Discord sign-in/out, first-time profile confirmation, sessions
- User/wallet creation and server-side route protection
- Basic profile menu and accessible error/recovery states

**Journeys:** sign in, cancel Discord consent, return with a session, sign out,
blocked/suspended account, mobile keyboard navigation.

### Phase 2 — Home

- Live-or-next-event hero, featured fight, upcoming fights
- Featured fighters/cards/listings using real seeded editorial data
- One announcement strip and signed-out/sign-in variants
- Admin-only minimal content controls required to populate the page

Daily reward is visually placed but not interactive until Phase 3; if placeholders
are forbidden literally, omit it entirely until Phase 3 rather than render a dead
control.

### Phase 3 — Crowns

- Wallet balance, immutable ledger, transaction-safe wallet operation
- Daily reward claim and compact recent activity
- Reward animation, reduced-motion equivalent, idempotency and concurrency tests
- Admin adjustment with reason, confirmation, and audit record

**Critical invariant:** cached wallet balance equals the sum of ledger deltas for
every user, and cannot become negative.

### Phase 4 — Coin Flip

- One-screen choice, wager, review, confirm, reveal, replay
- Server-generated outcome, atomic wager/payout, published rules
- Animation/sound controls, rate limits, reconnect and retry behavior
- Statistical payout tests and security review of result handling

### Phase 5 — Blackjack

- One ruleset, one hand at a time, hit/stand/double only if rules support it
- Server-owned deck and state machine expressed directly in feature code
- Deal/chip animation, keyboard controls, skip/reduced-motion paths
- Exhaustive rule table tests and interrupted-session recovery

Splits, insurance, side bets, multiple hands, and multiplayer are excluded from
the first version unless the product owner explicitly changes scope.

### Phase 6 — High-Low

- One-screen higher/lower choice, visible multiplier, cash-out, reveal history
- Server-owned deck/outcomes and atomic wallet settlement
- Clear tie rule, maximum steps, reconnect handling, animation and tests

### Phase 7 — Live Events

- Event and fighter pages, immersive live event screen, countdown
- Red/blue fighter presentation, human-readable update timeline, result state
- SSE updates with reconnect/poll fallback; admin event/update controls
- Load and degraded-network tests

Video hosting/stream licensing must be selected as a deliberate separate product
decision. The first implementation may embed an authorized stream; it should not
build a video platform.

### Phase 8 — Fight Betting

- Winner-only market, pick/amount/review/confirm on one screen
- Fixed accepted odds, bet slip/history, lock/settle/void operations
- Atomic wallet operations and audited admin settlement
- Boundary-time, concurrent settlement, void, and retry tests

### Phase 9 — Trading Cards

- Set browsing, collection, card detail, rarity/serial presentation
- Pack purchase and server-committed reveal
- Published drop rates, reveal-all/reduced-motion controls
- Ownership, duplicate, distribution, and concurrency tests

### Phase 10 — Marketplace

- Browse with URL filters, featured/recent listings, set completion hints
- List, review, buy, cancel, and sale history
- Atomic Crown/card transfer, stale-listing handling, visible fee policy
- Race tests proving only one buyer can win a listing

Direct negotiation and card-for-card trades are deferred until marketplace usage
shows they are needed.

### Phase 11 — Fight Requests

- Simple contextual request form and status view
- Eligibility/rate limits, notification, accept/decline/cancel rules
- Moderator queue only where abuse handling requires it

The exact meaning of a fight request must be product-defined before this phase:
fighter matchmaking, creator challenge, or event application are materially
different products.

### Phase 12 — Admin Control Center

Each earlier phase may include the smallest admin controls needed to operate it.
This phase unifies and polishes them into a separate control center:

- Today view: live event, actions requiring attention, system health
- Events/matches and rankings
- Economy and Crown audit tools
- Cards, packs, marketplace moderation
- Users, roles, suspensions, audit trail, system settings

Avoid generic table builders and configurable workflows. Each admin screen is
designed around an operator task with safe defaults and explicit consequences.

## 12. Definition of done for every feature

A feature ships only when all applicable items pass:

### Product

- The primary action and success state are obvious without a tutorial.
- Final copy is present; no placeholder, disabled “coming soon,” or fake activity.
- Empty, loading, error, expired, signed-out, and insufficient-Crown states work.
- Product analytics answer whether players discover and complete the flow.

### Engineering

- Server validation and authorization cover every mutation.
- Database constraints protect invariants under concurrency and retries.
- Failure/recovery behavior is tested, including interrupted requests.
- Structured errors and operational metrics are present.
- No speculative abstraction was added.

### Experience

- Responsive at 360, 768, 1024, and wide desktop layouts.
- Keyboard-only and screen-reader flow is usable.
- Contrast, focus, touch target, zoom, and axe checks pass.
- Motion is polished and the reduced-motion experience is equally complete.
- Loading and interaction performance meets the agreed budgets.

### Testing

- Domain rules have fast unit tests.
- Server actions have database integration tests.
- Components cover important interaction and accessibility states.
- One happy and key failure journey run in Playwright on mobile and desktop.
- Crown/game/marketplace invariants have concurrency and idempotency tests.

## 13. Testing strategy

### Test pyramid by risk

- **Unit:** payout math, card/deck rules, odds snapshots, eligibility, formatting.
- **Integration with real PostgreSQL:** wallet operations, game rounds, betting
  settlement, pack opening, marketplace purchase, authorization.
- **Component:** selection, validation, dialogs, keyboard behavior, announcements,
  reduced-motion rendering.
- **End-to-end:** a small number of player journeys per finished feature.
- **Visual regression:** hero, live fight, casino tables, collectible cards, pack
  reveal result, and key responsive breakpoints.

Do not mock the database for transaction-critical tests. Run each integration
test with isolated data and deterministic injected randomness. Production still
uses secure randomness; tests use a controlled implementation to assert outcomes.

### Mandatory invariant tests

- A retried mutation cannot spend or reward Crowns twice.
- Simultaneous spends cannot make a wallet negative.
- Every wallet balance reconciles to immutable entries.
- A game round settles at most once.
- A bet uses the odds accepted at placement and settles at most once.
- A card cannot have two owners or two active listings.
- Two simultaneous buyers cannot both purchase one listing.
- Admin changes are unauthorized without role and audited with role.

### Performance budgets

Set budgets early and measure on a mid-range mobile profile:

- Core Web Vitals remain in the “good” range at the 75th percentile.
- Initial player shell avoids shipping casino/card animation code.
- Route-level code splitting loads rich animation only for the active experience.
- Hero and fighter images use responsive sizes and modern formats.
- Live update reconnects back off and never flood the server.

## 14. Economy and trust rules to decide before coding Crowns

Architecture cannot substitute for economy design. Approve these values before
Phase 3 or the implementation will encode accidental policy:

- Starting balance and daily reward amount/cadence
- Wager minimums/maximums and per-game payout/house-edge tables
- Betting odds ownership and update process
- Pack prices, rarity/drop rates, duplicate policy, and supply limits
- Marketplace listing rules, minimum/maximum price, and fee/sink policy
- Refund/void policy and admin adjustment authority
- Geographic/age eligibility and responsible-play protections
- Economy monitoring: issuance, sinks, concentration, inflation, and abuse signals

All rates and rules shown to players must match server rule versions. Never hide
material odds or imply Crowns have monetary value.

## 15. Analytics without surveillance

Track a short, purposeful funnel:

- Home viewed → feature selected
- Discord login started → completed
- Daily reward eligible → claimed
- Game opened → wager confirmed → result shown → replayed
- Live event opened → bet started → confirmed
- Pack viewed → purchased → reveal completed
- Marketplace searched → listing viewed → purchase completed

Include feature/result IDs and broad device/performance context, not private
Discord data. Never include session tokens, free-form sensitive text, or exact
wallet histories in analytics payloads. Document retention and consent behavior.

## 16. Decisions that intentionally remain open

These need owner input or external review; guessing would create product risk:

1. RFL logo, exact typefaces, fighter/card art direction, and asset rights.
2. Operating regions, minimum age, and legal classification of virtual-currency
   betting and casino-style play.
3. Whether live events embed licensed video, link externally, or provide only a
   live companion experience.
4. Crown economy numbers and responsible-play limits.
5. The exact real-world meaning and lifecycle of Fight Requests.
6. DigitalOcean region and initial App Platform/database sizes, selected after
   traffic geography and budget expectations are known.

None of these justify a generic framework. They are explicit product decisions
to settle at the phase where they become necessary.

## 17. First implementation slice after approval

When coding is authorized, implement only Phase 1:

1. Create the single Next.js application and PostgreSQL development setup.
2. Establish the foundation tokens and public/player shells.
3. Add Auth.js Discord login with minimal scopes.
4. Create users, provider accounts/sessions, roles, and one wallet per user.
5. Add first-login confirmation, sign-out, suspended-state handling, and admin
   route guard—without building admin screens.
6. Test desktop/mobile, keyboard, OAuth failure, replay, and authorization paths.

Then stop, review the complete feature in the browser, and approve it before
starting Home.

## 18. Production deployment architecture

### Default DigitalOcean topology

```text
Custom domain + managed HTTPS
             │
             ▼
DigitalOcean App Platform
  └── RFL web service (one production container image)
        ├── DigitalOcean Managed PostgreSQL (private/VPC connection, TLS)
        ├── DigitalOcean Spaces (fighter, card, and event media)
        └── error monitoring and structured logs
```

Start with one web-service instance. The application must be stateless so App
Platform can replace or horizontally scale instances without changing behavior:

- Sessions use signed cookies and/or the shared database, never process memory.
- Uploads go to object storage, never the container filesystem.
- Crown/game locks and idempotency live in PostgreSQL, never an in-memory mutex.
- Start cross-instance rate limiting in PostgreSQL at modest volume; add managed
  Valkey only after metrics demonstrate the need.
- Scheduled work is idempotent and runs as an App Platform job, never as an
  interval inside every web instance.

App Platform receives one production container built by the repository's
multi-stage `Dockerfile`. The container listens on the platform-supplied `PORT`
and binds to all interfaces. Neither the port nor hostname is a source constant.

### Why a production Dockerfile

DigitalOcean can build supported Node/Next.js projects directly, but a small
production Dockerfile gives Droplets and App Platform the same artifact, pins the
Node runtime, runs as a non-root user, and makes fresh deployments repeatable. It
does not introduce Docker orchestration or Kubernetes.

The image contains only production runtime output and static assets. It contains
no environment files, development dependencies, test fixtures, database dumps,
or uploaded media. Tag deployable images with an immutable commit SHA; never rely
on `latest` for rollback identity.

### Environment separation

| Environment | Purpose | Data and integrations |
|---|---|---|
| Local | Development and automated tests | Local PostgreSQL, Discord test app, seed data |
| Staging | Production-like release verification | Separate managed database/bucket and Discord app |
| Production | Official public platform | Production database/bucket, Discord app, and domain |

Production and staging never share a database, bucket write credentials, OAuth
application, cookie namespace, or encryption secret. Preview deployments must
not receive production secrets or connect to production data.

### Custom domain and HTTPS

- Configure the canonical public origin through `APP_URL`; derive callbacks and
  absolute URLs from it.
- Register the exact production callback URL in the Discord application.
- Add the custom domain in App Platform and use its managed TLS certificate.
- Redirect HTTP to HTTPS and all alternate hostnames to one canonical hostname.
- Trust forwarded host/protocol headers only from the platform proxy; reject
  unexpected production hosts.
- Enable HSTS after the real domain is verified. Add `includeSubDomains` only when
  every subdomain is confirmed HTTPS-only.
- Set secure, HTTP-only, same-site session cookies in production.

No generated link, OAuth callback, media URL, or API call contains a hardcoded
domain, `localhost`, scheme, port, or DigitalOcean starter hostname.

## 19. Environment configuration contract

Validate the environment once during startup and exit with a clear
variable-name-only error when required configuration is absent or malformed.
Secret values never appear in logs or client bundles.

| Variable | Secret | Scope | Purpose |
|---|---|---|---|
| `NODE_ENV` | No | Build/runtime | Framework production behavior |
| `PORT` | No | Runtime | Platform-provided listen port |
| `APP_URL` | No | Build/runtime | Canonical absolute HTTPS origin |
| `DATABASE_URL` | Yes | Runtime/job | Pooled application database connection with TLS |
| `DIRECT_DATABASE_URL` | Yes | Migration job | Direct database connection for migrations |
| `AUTH_SECRET` | Yes | Runtime | High-entropy authentication secret |
| `DISCORD_CLIENT_ID` | No | Runtime | Discord OAuth application ID |
| `DISCORD_CLIENT_SECRET` | Yes | Runtime | Discord OAuth credential |
| `OBJECT_STORAGE_ENDPOINT` | No | Runtime | Spaces S3-compatible endpoint |
| `OBJECT_STORAGE_REGION` | No | Runtime | Spaces region |
| `OBJECT_STORAGE_BUCKET` | No | Runtime | Environment-specific bucket |
| `OBJECT_STORAGE_ACCESS_KEY` | Yes | Runtime | Least-privilege Spaces key |
| `OBJECT_STORAGE_SECRET_KEY` | Yes | Runtime | Spaces secret |
| `OBJECT_STORAGE_PUBLIC_URL` | No | Runtime | CDN/media origin if used |
| `LOG_LEVEL` | No | Runtime | Structured-log threshold |
| `SENTRY_DSN` | Yes | Build/runtime | Error reporting if Sentry is selected |

Add variables only with a shipped capability. `.env.example` documents every
accepted name with empty or harmless values. Real environment files are ignored
by Git. DigitalOcean stores production secrets as encrypted runtime variables;
secrets are not build arguments. Browser-visible variables require an explicit
public prefix and may never contain credentials.

Generate separate high-entropy secrets per environment, require MFA on provider
accounts, grant minimum operator access, and rotate credentials after staff access
changes or suspected exposure. Secrets never travel through tickets, chat,
screenshots, source control, or application logs.

## 20. Delivery and update process

### Continuous integration

Every proposed production change passes on the pinned Node version:

1. Locked dependency installation (`npm ci`)
2. Formatting/lint and TypeScript checks
3. Unit and component tests
4. PostgreSQL integration tests
5. Production container build
6. Playwright smoke journey against an isolated test application where practical
7. Dependency and container vulnerability scanning

Commit the lockfile. Automated dependency updates are reviewed and tested;
production never installs unconstrained package versions.

### Deployment sequence

1. Merge a reviewed commit after CI passes.
2. Build one immutable image identified by commit SHA.
3. Deploy that image to staging and run migration checks and smoke journeys.
4. Approve production deployment.
5. Run `prisma migrate deploy` as a one-off release job before new code receives
   traffic when the migration is backward-compatible.
6. Deploy the immutable web image and wait for readiness checks.
7. Run non-economy-mutating production smoke checks.
8. Record the release SHA and migration version.

Use expand/migrate/contract for breaking schema evolution: add compatible schema,
deploy compatible code/backfill, then remove obsolete schema in a later release.
A failed release rolls the app back to the last known image, so schema changes
must preserve application rollback.

Do not automatically deploy every production-branch push until staging, checks,
and rollback are proven. Easy updates mean repeatable safe releases, not
unreviewed releases.

### Health endpoints

- `/api/health/live` confirms the process can answer without dependency calls.
- `/api/health/ready` confirms required configuration and a short database query.
- Responses expose no versions, secrets, connection strings, or topology.
- App Platform readiness checks target the readiness endpoint and do not route
  traffic to an unready instance.

## 21. Production data, backup, and recovery

Use DigitalOcean Managed PostgreSQL in the same region/VPC as App Platform.
Enforce TLS, restrict trusted sources, use a least-privilege application user,
and reserve a separate migration owner.

Managed PostgreSQL provides automatic backups and point-in-time recovery within
its provider retention window. RFL additionally requires recovery discipline:

- Document the actual retention window and recovery objectives before launch;
  never describe backups as indefinite.
- Run encrypted logical exports to separate storage if business retention must
  exceed the managed window.
- Test a point-in-time restore into a new non-production cluster before launch
  and at least quarterly.
- After restore, reconcile wallet balances and ledger entries, settled games and
  bets, card ownership, listings, and sales before reopening writes.
- Back up media separately or enable bucket versioning where the selected Spaces
  configuration satisfies the recovery model.
- Never treat a Droplet disk or container filesystem as a database/media backup.
- Require two-person confirmation and a verified independent export before
  destroying a managed database and its provider-held backups.

Suggested initial targets, pending business approval: **RPO under 15 minutes for
PostgreSQL and 24 hours for media; RTO four hours.** Validate them against the
selected plan with a timed restore exercise.

## 22. Security and operational baseline

Before public launch:

- Apply CSP, frame restrictions, MIME-sniffing protection, a conservative
  referrer policy, and a permissions policy.
- Keep Next.js, Auth.js, Node, Prisma, PostgreSQL, and base images on supported
  security releases; schedule monthly maintenance and urgent critical patches.
- Run the container as non-root with no SSH service.
- Use parameterized ORM queries, Zod limits, server authorization, suitable CSRF
  defenses, and output encoding.
- Rate-limit authentication and every Crown-, casino-, betting-, marketplace-,
  notification-, request-, and admin-writing action.
- Redact cookies, authorization headers, OAuth codes, personal data, and all
  secrets from logs and error reports.
- Alert on deployment failure, unhealthy instances, elevated errors/latency,
  database saturation, failed jobs, auth spikes, and wallet reconciliation errors.
- Maintain runbooks for incidents, credential rotation, rollback, database
  restore, Discord outage, and Crown-write suspension.

These controls are not proof of security. Before public economy activity, obtain
a focused independent review of authentication, authorization, Crown transactions,
randomness, betting settlement, marketplace races, admin actions, and deployment
configuration.

## 23. Production readiness gate

Use the official custom domain only after all applicable checks pass:

- A fresh App Platform deployment succeeds from the checked-in app spec and
  documented environment contract without source edits.
- Staging and production run the same immutable image.
- Source/build artifacts contain no fixed ports, credentials, or
  environment-specific service URLs outside tests and documentation.
- Production startup rejects missing or invalid configuration safely.
- HTTPS, canonical-host redirects, OAuth callbacks, cookies, CSP, and headers are
  verified against the real domain.
- Migrations, backup restore, application rollback, and credential rotation are
  rehearsed.
- Health checks, logs, monitoring, and operational alerts work.
- Fight-night load tests verify database connection limits, SSE reconnect behavior,
  and Crown mutation latency.
- Accessibility, responsive, performance, security, and feature definitions of
  done pass in a production-like environment.
- Legal/privacy terms, Crown rules, eligibility, responsible-play controls,
  support contact, and incident ownership are approved and published.

Repeat this gate for major economy or infrastructure changes. Production
readiness is maintained continuously, not achieved once at launch.
