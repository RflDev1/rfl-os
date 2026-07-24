# syntax=docker/dockerfile:1
FROM node:24-alpine AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:24-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
ENV APP_URL=https://build.invalid \
    DATABASE_URL=postgresql://build:build@database.invalid:5432/rfl \
    AUTH_SECRET=build-only-secret-not-used-at-runtime-000000000 \
    DISCORD_CLIENT_ID=build-client \
    DISCORD_CLIENT_SECRET=build-secret \
    DISCORD_BOT_TOKEN=build-bot-token \
    DISCORD_API_BASE_URL=https://discord.invalid/api/v10 \
    DISCORD_GUILD_ID=1514881431229431868 \
    DAILY_REWARD_AMOUNT=100 \
    COIN_FLIP_MIN_WAGER=10 \
    COIN_FLIP_MAX_WAGER=1000 \
    COIN_FLIP_PAYOUT_BPS=20000 \
    COIN_FLIP_MAX_PLAYS_PER_MINUTE=20 \
    BLACKJACK_MIN_WAGER=10 \
    BLACKJACK_MAX_WAGER=1000 \
    BLACKJACK_PAYOUT_BPS=20000 \
    BLACKJACK_NATURAL_PAYOUT_BPS=25000 \
    BLACKJACK_MAX_ROUNDS_PER_MINUTE=10 \
    HIGH_LOW_MIN_WAGER=10 \
    HIGH_LOW_MAX_WAGER=1000 \
    HIGH_LOW_TARGET_RETURN_BPS=9500 \
    HIGH_LOW_MAX_STEPS=7 \
    HIGH_LOW_MAX_ROUNDS_PER_MINUTE=10 \
    BET_MIN_WAGER=10 \
    BET_MAX_WAGER=5000 \
    BET_MAX_PLACEMENTS_PER_MINUTE=20 \
    PACK_MAX_OPENINGS_PER_MINUTE=10 \
    MARKET_MIN_PRICE=10 \
    MARKET_MAX_PRICE=100000 \
    FIGHT_REQUEST_RANK_RANGE=5
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
RUN npm run db:generate && npm run build

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 8080
CMD ["node", "server.js"]
