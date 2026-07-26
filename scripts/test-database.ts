import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import EmbeddedPostgres from "embedded-postgres";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

async function availablePort() {
  const server = net.createServer();
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  assert(address && typeof address !== "string");
  const port = address.port;
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return port;
}

async function main() {
const databaseDir = await mkdtemp(path.join(os.tmpdir(), "rfl-postgres-"));
const port = await availablePort();
const user = "rfl_test";
const password = "rfl_test_only_password";
const database = "rfl_integration";
const postgres = new EmbeddedPostgres({
  databaseDir,
  port,
  user,
  password,
  persistent: false,
  initdbFlags: ["--locale=C", "--encoding=UTF8"],
  onLog: () => undefined,
  onError: (message) => process.stderr.write(`${String(message)}\n`),
});

let prisma: PrismaClient | undefined;
let servicePrisma: PrismaClient | undefined;

try {
  await postgres.initialise();
  await postgres.start();
  await postgres.createDatabase(database);

  const databaseUrl = `postgresql://${user}:${password}@127.0.0.1:${port}/${database}`;
  const migration = spawnSync("npm", ["run", "db:deploy"], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: databaseUrl, DIRECT_DATABASE_URL: databaseUrl },
    encoding: "utf8",
  });
  assert.equal(migration.status, 0, `${migration.stdout}\n${migration.stderr}`);

  prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });

  const applied = await prisma.$queryRaw<Array<{ migration_name: string }>>`
    SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL ORDER BY migration_name
  `;
  assert.deepEqual(applied.map(({ migration_name }) => migration_name), [
    "20260718010000_phase_1_identity",
    "20260718020000_home_content",
    "20260718030000_crowns",
    "20260718031000_admin_audit",
    "20260718040000_coin_flip",
    "20260718050000_blackjack",
    "20260718060000_high_low",
    "20260718070000_live_events",
    "20260718080000_fight_betting",
    "20260718090000_trading_cards",
    "20260718100000_marketplace",
    "20260718110000_fight_requests",
    "20260722010000_fighter_status",
    "20260724010000_fighter_analyst_role",
    "20260724230000_discord_fight_reminders",
    "20260726010000_database_card_images",
  ]);

  const player = await prisma.user.create({
    data: {
      displayName: "Integration Fighter",
      profileCompletedAt: new Date(),
      wallet: { create: {} },
      roles: { create: { role: "PLAYER" } },
    },
    include: { wallet: true, roles: true },
  });
  assert.equal(player.wallet?.balance, 0);
  assert.deepEqual(player.roles.map(({ role }) => role), ["PLAYER"]);

  await assert.rejects(
    prisma.$executeRaw`UPDATE "wallets" SET "balance" = -1 WHERE "user_id" = ${player.id}`,
    /wallets_balance_nonnegative/,
  );

  Object.assign(process.env, {
    NODE_ENV: "test",
    APP_URL: "https://integration.rfl.invalid",
    DATABASE_URL: databaseUrl,
    AUTH_SECRET: "integration-test-auth-secret-000000000",
    DISCORD_CLIENT_ID: "integration-client",
    DISCORD_CLIENT_SECRET: "integration-secret",
    DISCORD_BOT_TOKEN: "integration-bot-token",
    DISCORD_API_BASE_URL: "https://discord.integration.invalid/api/v10",
    DISCORD_GUILD_ID: "1514881431229431868",
    DAILY_REWARD_AMOUNT: "100",
    COIN_FLIP_MIN_WAGER: "10",
    COIN_FLIP_MAX_WAGER: "1000",
    COIN_FLIP_PAYOUT_BPS: "20000",
    COIN_FLIP_MAX_PLAYS_PER_MINUTE: "20",
    BLACKJACK_MIN_WAGER: "10",
    BLACKJACK_MAX_WAGER: "1000",
    BLACKJACK_PAYOUT_BPS: "20000",
    BLACKJACK_NATURAL_PAYOUT_BPS: "25000",
    BLACKJACK_MAX_ROUNDS_PER_MINUTE: "10",
    HIGH_LOW_MIN_WAGER: "10",
    HIGH_LOW_MAX_WAGER: "1000",
    HIGH_LOW_TARGET_RETURN_BPS: "9500",
    HIGH_LOW_MAX_STEPS: "7",
    HIGH_LOW_MAX_ROUNDS_PER_MINUTE: "10",
    BET_MIN_WAGER: "10",
    BET_MAX_WAGER: "5000",
    BET_MAX_PLACEMENTS_PER_MINUTE: "20",
    PACK_MAX_OPENINGS_PER_MINUTE: "10",
    MARKET_MIN_PRICE: "10",
    MARKET_MAX_PRICE: "100000",
    FIGHT_REQUEST_RANK_RANGE: "5",
  });
  const walletService = await import("../src/features/wallet/wallet.service");
  const bettingService = await import("../src/features/betting/betting.service");
  const cardsService = await import("../src/features/cards/cards.service");
  const marketplaceService = await import("../src/features/marketplace/marketplace.service");
  const fightRequestService = await import("../src/features/fight-requests/fight-requests.service");
  const discordService = await import("../src/features/fight-requests/discord.service");
  const fightResultService = await import("../src/features/live/fight-results.service");
  servicePrisma = (await import("../src/lib/prisma")).prisma;
  const rewardNow = new Date("2026-07-18T12:00:00Z");
  const concurrentClaims = await Promise.all([
    walletService.claimDailyReward(player.id, 100, rewardNow),
    walletService.claimDailyReward(player.id, 100, rewardNow),
  ]);
  assert.equal(concurrentClaims.filter(({ claimed }) => claimed).length, 1);
  assert.equal(concurrentClaims.filter(({ claimed }) => !claimed).length, 1);

  const rewardedWallet = await prisma.wallet.findUniqueOrThrow({
    where: { userId: player.id },
    include: { entries: true },
  });
  const rewardClaims = await prisma.dailyRewardClaim.count({ where: { userId: player.id } });
  assert.equal(rewardedWallet.balance, 100);
  assert.equal(rewardedWallet.entries.length, 1);
  assert.equal(rewardedWallet.entries.reduce((sum, entry) => sum + entry.delta, 0), rewardedWallet.balance);
  assert.equal(rewardClaims, 1);

  const adjustmentKey = "6c3c2fcf-45e2-4ff5-b567-16d7640db74e";
  const firstAdjustment = await walletService.adjustWallet({
    actorId: player.id,
    userId: player.id,
    delta: 50,
    note: "Integration test adjustment.",
    idempotencyKey: adjustmentKey,
  });
  const repeatedAdjustment = await walletService.adjustWallet({
    actorId: player.id,
    userId: player.id,
    delta: 50,
    note: "Integration test adjustment.",
    idempotencyKey: adjustmentKey,
  });
  assert.equal(firstAdjustment.changed, true);
  assert.equal(repeatedAdjustment.changed, false);
  assert.equal((await prisma.wallet.findUniqueOrThrow({ where: { userId: player.id } })).balance, 150);
  assert.equal(await prisma.adminAuditEntry.count({ where: { actorId: player.id } }), 1);
  await assert.rejects(
    walletService.adjustWallet({
      actorId: player.id,
      userId: player.id,
      delta: -151,
      note: "Invalid negative-balance attempt.",
      idempotencyKey: "84b50d2e-a14c-4074-bd23-fbea69e644f0",
    }),
    /negative/,
  );

  const coinFlipService = await import("../src/features/coin-flip/coin-flip.service");
  const coinInput = {
    userId: player.id,
    choice: "HEADS" as const,
    wager: 50,
    idempotencyKey: "ae1ea30a-4610-4c17-87d4-7ac44f3893e7",
    payoutBasisPoints: 20_000,
    maxPlaysPerMinute: 20,
  };
  const simultaneousFlips = await Promise.all([
    coinFlipService.playCoinFlip(coinInput, () => "HEADS"),
    coinFlipService.playCoinFlip(coinInput, () => "HEADS"),
  ]);
  assert.equal(simultaneousFlips.filter(({ replayed }) => !replayed).length, 1);
  assert.equal(simultaneousFlips.every(({ won, payout }) => won && payout === 100), true);
  assert.equal((await prisma.wallet.findUniqueOrThrow({ where: { userId: player.id } })).balance, 200);

  const loss = await coinFlipService.playCoinFlip({
    ...coinInput,
    wager: 25,
    idempotencyKey: "c128074c-9330-492d-8246-505c013d278c",
  }, () => "TAILS");
  assert.equal(loss.won, false);
  assert.equal(loss.payout, 0);
  const finalWallet = await prisma.wallet.findUniqueOrThrow({
    where: { userId: player.id },
    include: { entries: true },
  });
  assert.equal(finalWallet.balance, 175);
  assert.equal(finalWallet.entries.reduce((sum, entry) => sum + entry.delta, 0), 175);
  assert.equal(await prisma.coinFlipRound.count({ where: { userId: player.id } }), 2);
  await assert.rejects(
    coinFlipService.playCoinFlip({
      ...coinInput,
      wager: 1000,
      idempotencyKey: "f405177d-23cd-43e3-9f22-d940d26f52c4",
    }, () => "HEADS"),
    /enough Crowns/,
  );

  const blackjackService = await import("../src/features/blackjack/blackjack.service");
  const natural = await blackjackService.startBlackjack({
    userId: player.id,
    wager: 20,
    idempotencyKey: "bd60f3bd-70bf-426f-ad6d-cea2099958d2",
    payoutBasisPoints: 20_000,
    blackjackPayoutBps: 25_000,
    maxRoundsPerMinute: 10,
  }, () => ["7C", "KH", "9D", "AS"]);
  assert.equal(natural.outcome, "PLAYER_BLACKJACK");
  assert.equal(natural.payout, 50);
  assert.equal(natural.balanceAfter, 205);

  const doubleRound = await blackjackService.startBlackjack({
    userId: player.id,
    wager: 20,
    idempotencyKey: "c6b28dab-17b3-4352-a15c-0474fbd7925d",
    payoutBasisPoints: 20_000,
    blackjackPayoutBps: 25_000,
    maxRoundsPerMinute: 10,
  }, () => ["5D", "10S", "7C", "6H", "9D", "5S"]);
  assert.equal(doubleRound.status, "ACTIVE");
  const doubleInput = {
    userId: player.id,
    roundId: doubleRound.id,
    move: "DOUBLE" as const,
    idempotencyKey: "35f9eb7f-9069-43f0-932f-52e2e2017f31",
  };
  const doubles = await Promise.all([
    blackjackService.actBlackjack(doubleInput),
    blackjackService.actBlackjack(doubleInput),
  ]);
  assert.equal(doubles.filter(({ replayed }) => !replayed).length, 1);
  assert.equal(doubles[0].outcome, "PUSH");
  assert.equal(doubles[0].totalWager, 40);
  assert.equal((await prisma.wallet.findUniqueOrThrow({ where: { userId: player.id } })).balance, 205);

  const bustRound = await blackjackService.startBlackjack({
    userId: player.id,
    wager: 10,
    idempotencyKey: "556f7070-cb21-4510-87a0-992a7ab2e1e3",
    payoutBasisPoints: 20_000,
    blackjackPayoutBps: 25_000,
    maxRoundsPerMinute: 10,
  }, () => ["5D", "7C", "9H", "9D", "10S"]);
  const bust = await blackjackService.actBlackjack({
    userId: player.id,
    roundId: bustRound.id,
    move: "HIT",
    idempotencyKey: "7f721b7c-75fc-4759-afbf-64f5fdfc8ab4",
  });
  assert.equal(bust.outcome, "PLAYER_BUST");
  assert.equal(bust.payout, 0);
  const afterBlackjack = await prisma.wallet.findUniqueOrThrow({ where: { userId: player.id }, include: { entries: true } });
  assert.equal(afterBlackjack.balance, 195);
  assert.equal(afterBlackjack.entries.reduce((sum, entry) => sum + entry.delta, 0), 195);
  assert.equal(await prisma.blackjackRound.count({ where: { userId: player.id } }), 3);

  const highLowService = await import("../src/features/high-low/high-low.service");
  const cashoutRound = await highLowService.startHighLow({
    userId: player.id,
    wager: 100,
    idempotencyKey: "aebdfa93-917e-46e6-a9fd-260369541ada",
    targetReturnBps: 9500,
    maxSteps: 7,
    maxRoundsPerMinute: 10,
  }, () => ["9S", "7H"]);
  const guessInput = { userId: player.id, roundId: cashoutRound.id, intent: "HIGHER" as const, idempotencyKey: "54a348cb-8b6c-4fc4-8bc0-69375c4ff8e5" };
  const guesses = await Promise.all([highLowService.actHighLow(guessInput), highLowService.actHighLow(guessInput)]);
  assert.equal(guesses.filter(({ replayed }) => !replayed).length, 1);
  assert.equal(guesses[0].step, 1);
  assert.equal(guesses[0].multiplierBps, 17_642);
  const cashed = await highLowService.actHighLow({ userId: player.id, roundId: cashoutRound.id, intent: "CASH_OUT", idempotencyKey: "75355760-c453-4b76-9b3f-2cc780fa7350" });
  assert.equal(cashed.outcome, "CASHED_OUT");
  assert.equal(cashed.payout, 176);
  assert.equal(cashed.balanceAfter, 271);

  const tieRound = await highLowService.startHighLow({ userId: player.id, wager: 10, idempotencyKey: "15f06aa6-8cff-4795-98da-c4735bd52acc", targetReturnBps: 9500, maxSteps: 7, maxRoundsPerMinute: 10 }, () => ["7S", "7H"]);
  const tied = await highLowService.actHighLow({ userId: player.id, roundId: tieRound.id, intent: "HIGHER", idempotencyKey: "821d82e9-1186-4afb-9c45-f530ffcf92a7" });
  assert.equal(tied.outcome, "TIE");
  assert.equal(tied.payout, 0);

  const maxRound = await highLowService.startHighLow({ userId: player.id, wager: 20, idempotencyKey: "6ca23862-52e5-499d-9aae-e47d9b58e055", targetReturnBps: 9500, maxSteps: 2, maxRoundsPerMinute: 10 }, () => ["7D", "6C", "5H"]);
  const firstStep = await highLowService.actHighLow({ userId: player.id, roundId: maxRound.id, intent: "HIGHER", idempotencyKey: "6605418b-c4e5-49d7-bf1b-40c788034bdb" });
  assert.equal(firstStep.status, "ACTIVE");
  const maxed = await highLowService.actHighLow({ userId: player.id, roundId: maxRound.id, intent: "HIGHER", idempotencyKey: "f2ab4de6-e358-423c-b847-f14b370f8847" });
  assert.equal(maxed.outcome, "MAX_STEPS");
  assert.equal(maxed.payout, 42);
  const afterHighLow = await prisma.wallet.findUniqueOrThrow({ where: { userId: player.id }, include: { entries: true } });
  assert.equal(afterHighLow.balance, 283);
  assert.equal(afterHighLow.entries.reduce((sum, entry) => sum + entry.delta, 0), 283);

  const [red, blue] = await prisma.$transaction([
    prisma.fighter.create({ data: { name: "Red Realm", wins: 4, losses: 1 } }),
    prisma.fighter.create({ data: { name: "Blue Realm", wins: 3, losses: 2 } }),
  ]);
  const event = await prisma.event.create({
    data: { title: "Integration Night", startsAt: new Date(Date.now() + 86_400_000), status: "SCHEDULED", featured: true },
  });
  const scheduledFight = await prisma.fight.create({
    data: { eventId: event.id, redFighterId: red.id, blueFighterId: blue.id, position: 1 },
  });
  await assert.rejects(
    prisma.fight.create({ data: { eventId: event.id, redFighterId: red.id, blueFighterId: red.id, position: 2 } }),
    /fights_distinct_fighters/,
  );

  const published = await prisma.event.findFirst({
    where: { status: "SCHEDULED", startsAt: { gt: new Date() } },
    include: { fights: { include: { redFighter: true, blueFighter: true } } },
  });
  assert.equal(published?.fights[0]?.redFighter.name, "Red Realm");
  assert.equal(published?.fights[0]?.blueFighter.name, "Blue Realm");

  const market = await prisma.betMarket.create({ data: { fightId: scheduledFight.id, redOddsBps: 20_000, blueOddsBps: 18_000 } });
  const betInput = { userId: player.id, marketId: market.id, selection: "RED" as const, stake: 20, idempotencyKey: "integration-bet-one", maxPlacementsPerMinute: 20 };
  const repeatedBets = await Promise.all([bettingService.placeBet(betInput), bettingService.placeBet(betInput)]);
  assert.equal(repeatedBets.filter(({ replayed }) => !replayed).length, 1);
  assert.equal(repeatedBets[0].acceptedOddsBps, 20_000);
  assert.equal(repeatedBets[0].possiblePayout, 40);
  await prisma.betMarket.update({ where: { id: market.id }, data: { redOddsBps: 30_000 } });
  const repricedBet = await bettingService.placeBet({ ...betInput, stake: 10, idempotencyKey: "integration-bet-two" });
  assert.equal(repricedBet.acceptedOddsBps, 30_000);
  assert.equal(repricedBet.possiblePayout, 30);
  assert.equal((await prisma.wallet.findUniqueOrThrow({ where: { userId: player.id } })).balance, 253);
  const voidFight = await prisma.fight.create({ data: { eventId: event.id, redFighterId: blue.id, blueFighterId: red.id, position: 2 } });
  const voidMarket = await prisma.betMarket.create({ data: { fightId: voidFight.id, redOddsBps: 19_000, blueOddsBps: 19_000 } });
  const voidBet = await bettingService.placeBet({ ...betInput, marketId: voidMarket.id, stake: 10, idempotencyKey: "integration-void-bet" });
  assert.equal(voidBet.balanceAfter, 243);
  const voidResults = await Promise.all([
    bettingService.settleMarket({ marketId: voidMarket.id, actorId: player.id, void: true }),
    bettingService.settleMarket({ marketId: voidMarket.id, actorId: player.id, void: true }),
  ]);
  assert.equal(voidResults.filter(({ replayed }) => !replayed).length, 1);
  assert.equal((await prisma.bet.findUniqueOrThrow({ where: { id: voidBet.id } })).status, "VOID");
  assert.equal((await prisma.wallet.findUniqueOrThrow({ where: { userId: player.id } })).balance, 253);

  await prisma.$transaction([
    prisma.event.update({ where: { id: event.id }, data: { status: "LIVE" } }),
    prisma.fight.updateMany({ where: { eventId: event.id }, data: { status: "LIVE" } }),
    prisma.fightUpdate.create({ data: { eventId: event.id, kind: "ANNOUNCEMENT", message: "The event is now live." } }),
  ]);
  const liveFight = scheduledFight;
  await prisma.$transaction([
    prisma.fight.update({ where: { id: liveFight.id }, data: { status: "COMPLETED", result: "RED_WIN", resultSummary: "Unanimous decision" } }),
    prisma.fightUpdate.create({ data: { eventId: event.id, fightId: liveFight.id, kind: "RESULT", message: "Red Realm wins by unanimous decision." } }),
  ]);
  const settlements = await Promise.all([
    bettingService.settleMarket({ marketId: market.id, actorId: player.id, void: false }),
    bettingService.settleMarket({ marketId: market.id, actorId: player.id, void: false }),
  ]);
  assert.equal(settlements.filter(({ replayed }) => !replayed).length, 1);
  const settledBets = await prisma.bet.findMany({ where: { marketId: market.id }, orderBy: { createdAt: "asc" } });
  assert.deepEqual(settledBets.map(({ status, payout }) => [status, payout]), [["WON", 40], ["WON", 30]]);
  const afterBetting = await prisma.wallet.findUniqueOrThrow({ where: { userId: player.id }, include: { entries: true } });
  assert.equal(afterBetting.balance, 323);
  assert.equal(afterBetting.entries.reduce((sum, entry) => sum + entry.delta, 0), 323);
  const liveSnapshot = await prisma.event.findUniqueOrThrow({ where: { id: event.id }, include: { fights: true, updates: { orderBy: { createdAt: "asc" } } } });
  assert.equal(liveSnapshot.status, "LIVE");
  assert.equal(liveSnapshot.fights.find(({ id }) => id === scheduledFight.id)?.result, "RED_WIN");
  assert.deepEqual(liveSnapshot.updates.map(({ kind }) => kind), ["ANNOUNCEMENT", "RESULT"]);

  const cardSet = await prisma.cardSet.create({ data: { name: "Integration Origins", code: "IT01", description: "Fictional integration set", releasedAt: new Date(Date.now() - 1_000), active: true } });
  const commonCard = await prisma.cardDefinition.create({ data: { setId: cardSet.id, fighterId: red.id, name: "Red Realm Rookie", subtitle: "First Strike", rarity: "COMMON", cardNumber: 1 } });
  await prisma.cardImage.create({
    data: {
      cardDefinitionId: commonCard.id,
      data: Buffer.from("integration-card-image"),
      contentType: "image/webp",
      byteSize: 22,
      checksum: "integration-checksum",
    },
  });
  await prisma.cardDefinition.create({ data: { setId: cardSet.id, fighterId: blue.id, name: "Blue Realm Elite", rarity: "RARE", cardNumber: 2 } });
  const pack = await prisma.packDefinition.create({ data: { setId: cardSet.id, name: "Integration Pack", price: 50, cardsPerPack: 3, commonWeight: 100, rareWeight: 0, epicWeight: 0, legendaryWeight: 0, active: true } });
  const packInput = { userId: player.id, packId: pack.id, idempotencyKey: "integration-pack-one", maxOpeningsPerMinute: 10 };
  const repeatedOpenings = await Promise.all([cardsService.openPack(packInput, () => 0), cardsService.openPack(packInput, () => 0)]);
  assert.equal(repeatedOpenings.filter(({ replayed }) => !replayed).length, 1);
  assert.equal(repeatedOpenings[0].price, 50);
  assert.equal(repeatedOpenings[0].cards.length, 3);
  assert.deepEqual(repeatedOpenings[0].cards.map(({ definitionId }) => definitionId), [commonCard.id, commonCard.id, commonCard.id]);
  assert.equal(new Set(repeatedOpenings[0].cards.map(({ serialNumber }) => serialNumber)).size, 3);
  assert.equal(await prisma.cardInstance.count({ where: { ownerId: player.id } }), 3);
  await prisma.packDefinition.update({ where: { id: pack.id }, data: { price: 200 } });
  const competingOpenings = await Promise.allSettled([
    cardsService.openPack({ ...packInput, idempotencyKey: "integration-pack-two" }, () => 0),
    cardsService.openPack({ ...packInput, idempotencyKey: "integration-pack-three" }, () => 0),
  ]);
  assert.equal(competingOpenings.filter(({ status }) => status === "fulfilled").length, 1);
  assert.equal(competingOpenings.filter(({ status }) => status === "rejected").length, 1);
  const afterPacks = await prisma.wallet.findUniqueOrThrow({ where: { userId: player.id }, include: { entries: true } });
  assert.equal(afterPacks.balance, 73);
  assert.equal(afterPacks.entries.reduce((sum, entry) => sum + entry.delta, 0), 73);
  assert.equal(await prisma.cardInstance.count({ where: { ownerId: player.id } }), 6);

  const databaseClient = prisma;
  const [buyerOne, buyerTwo] = await Promise.all(["Market Buyer One", "Market Buyer Two"].map((displayName, index) => databaseClient.user.create({ data: { displayName, profileCompletedAt: new Date(), roles: { create: { role: "PLAYER" } }, wallet: { create: { balance: 500, entries: { create: { delta: 500, balanceAfter: 500, reason: "ADMIN_ADJUSTMENT", idempotencyKey: `market-buyer-seed-${index}` } } } } } })));
  const sellerCards = await prisma.cardInstance.findMany({ where: { ownerId: player.id }, orderBy: { serialNumber: "asc" } });
  const listingAttempts = await Promise.allSettled([
    marketplaceService.createListing({ sellerId: player.id, cardInstanceId: sellerCards[0]!.id, price: 125 }),
    marketplaceService.createListing({ sellerId: player.id, cardInstanceId: sellerCards[0]!.id, price: 125 }),
  ]);
  assert.equal(listingAttempts.filter(({ status }) => status === "fulfilled").length, 1);
  assert.equal(listingAttempts.filter(({ status }) => status === "rejected").length, 1);
  const activeListing = await prisma.marketListing.findFirstOrThrow({ where: { cardInstanceId: sellerCards[0]!.id, status: "ACTIVE" } });
  const purchaseAttempts = await Promise.allSettled([
    marketplaceService.buyListing({ buyerId: buyerOne.id, listingId: activeListing.id, idempotencyKey: "04d99778-121f-4fc3-a2ee-67f910983655" }),
    marketplaceService.buyListing({ buyerId: buyerTwo.id, listingId: activeListing.id, idempotencyKey: "18e74ae1-fdd8-4a05-a265-867af58f7670" }),
  ]);
  assert.equal(purchaseAttempts.filter(({ status }) => status === "fulfilled").length, 1);
  assert.equal(purchaseAttempts.filter(({ status }) => status === "rejected").length, 1);
  const sale = await prisma.marketSale.findUniqueOrThrow({ where: { listingId: activeListing.id } });
  const replayedSale = await marketplaceService.buyListing({ buyerId: sale.buyerId, listingId: activeListing.id, idempotencyKey: sale.idempotencyKey });
  assert.equal(replayedSale.replayed, true);
  assert.equal((await prisma.cardInstance.findUniqueOrThrow({ where: { id: sellerCards[0]!.id } })).ownerId, sale.buyerId);
  assert.equal((await prisma.wallet.findUniqueOrThrow({ where: { userId: player.id } })).balance, 198);
  assert.equal((await prisma.wallet.findUniqueOrThrow({ where: { userId: sale.buyerId } })).balance, 375);
  const cancelledListing = await marketplaceService.createListing({ sellerId: player.id, cardInstanceId: sellerCards[1]!.id, price: 90 });
  await marketplaceService.cancelListing({ sellerId: player.id, listingId: cancelledListing.id });
  assert.equal((await prisma.marketListing.findUniqueOrThrow({ where: { id: cancelledListing.id } })).status, "CANCELLED");
  await assert.rejects(marketplaceService.buyListing({ buyerId: buyerOne.id, listingId: cancelledListing.id, idempotencyKey: "6af48de7-1877-43d2-8275-a6695747014d" }), /no longer available/);

  const opponentUser = await prisma.user.create({ data: { displayName: "Rank Fifteen Fighter", profileCompletedAt: new Date(), roles: { create: { role: "PLAYER" } }, wallet: { create: {} }, accounts: { create: { type: "oauth", provider: "discord", providerAccountId: "discord-rank-15" } } } });
  const outsideUser = await prisma.user.create({ data: { displayName: "Rank Sixteen Fighter", profileCompletedAt: new Date(), roles: { create: { role: "PLAYER" } }, wallet: { create: {} }, accounts: { create: { type: "oauth", provider: "discord", providerAccountId: "discord-rank-16" } } } });
  await prisma.account.create({ data: { userId: player.id, type: "oauth", provider: "discord", providerAccountId: "discord-rank-10" } });
  await prisma.fighter.update({ where: { id: red.id }, data: { userId: player.id, rank: 10 } });
  await prisma.fighter.update({ where: { id: blue.id }, data: { userId: opponentUser.id, rank: 15 } });
  const outsideFighter = await prisma.fighter.create({ data: { name: "Outside Range", userId: outsideUser.id, rank: 16 } });
  await assert.rejects(fightRequestService.submitFightRequest({ userId: player.id, opponentFighterId: outsideFighter.id, rankRange: 5 }), /outside your eligible rank range/);
  const requestAttempts = await Promise.allSettled([
    fightRequestService.submitFightRequest({ userId: player.id, opponentFighterId: blue.id, rankRange: 5 }),
    fightRequestService.submitFightRequest({ userId: player.id, opponentFighterId: blue.id, rankRange: 5 }),
  ]);
  assert.equal(requestAttempts.filter(({ status }) => status === "fulfilled").length, 1);
  const pendingRequest = await prisma.fightRequest.findFirstOrThrow({ where: { requesterFighterId: red.id, opponentFighterId: blue.id, status: "PENDING" } });
  const scheduledEvent = await prisma.event.create({ data: { title: "Approved Challenge Night", startsAt: new Date(Date.now() + 172_800_000), status: "SCHEDULED" } });
  const approvedRequest = await fightRequestService.reviewFightRequest({ requestId: pendingRequest.id, actorId: player.id, operation: "APPROVE", eventId: scheduledEvent.id, rankRange: 5 });
  assert.equal(approvedRequest.status, "APPROVED");
  assert.ok(approvedRequest.fightId);
  const approvedFight = await prisma.fight.findUniqueOrThrow({ where: { id: approvedRequest.fightId! } });
  assert.equal(approvedFight.eventId, scheduledEvent.id);
  assert.equal(await prisma.discordNotification.count({ where: { fightRequestId: pendingRequest.id } }), 8);
  await assert.rejects(fightRequestService.reviewFightRequest({ requestId: pendingRequest.id, actorId: player.id, operation: "APPROVE", eventId: scheduledEvent.id, rankRange: 5 }), /already been reviewed/);
  const notificationJobs = await prisma.discordNotification.findMany({ where: { fightRequestId: pendingRequest.id, kind: "FIGHT_APPROVED" } });
  for (const job of notificationJobs) {
    let call = 0;
    await discordService.deliverDiscordNotification(job.id, { apiBaseUrl: "https://discord.integration.invalid/api/v10", botToken: "test", appUrl: "https://integration.rfl.invalid" }, async () => {
      call += 1;
      return call === 1 ? new Response(JSON.stringify({ id: "dm-channel" }), { status: 200, headers: { "content-type": "application/json" } }) : new Response(JSON.stringify({ id: "message" }), { status: 200, headers: { "content-type": "application/json" } });
    });
  }
  assert.equal(await prisma.discordNotification.count({ where: { fightRequestId: pendingRequest.id, status: "SENT" } }), 2);
  await fightResultService.completeFight({ fightId: approvedFight.id, result: "BLUE_WIN", resultSummary: "Upset decision", actorId: player.id });
  const [rankedRed, rankedBlue] = await Promise.all([
    prisma.fighter.findUniqueOrThrow({ where: { id: red.id } }),
    prisma.fighter.findUniqueOrThrow({ where: { id: blue.id } }),
  ]);
  assert.equal(rankedRed.rank, 15);
  assert.equal(rankedBlue.rank, 10);
  assert.equal(rankedRed.losses, red.losses + 1);
  assert.equal(rankedBlue.wins, blue.wins + 1);
  await assert.rejects(
    fightResultService.completeFight({ fightId: approvedFight.id, result: "BLUE_WIN", actorId: player.id }),
    /already completed/,
  );

  const resetService = await import("../src/features/admin/testing-reset.service");
  const reset = await resetService.resetTestingData(player.id);
  assert.ok(reset.removedUsers >= 4);
  assert.ok(reset.removedFighters >= 3);
  assert.ok(reset.removedFights >= 3);
  assert.equal(await prisma.user.count(), 1);
  assert.equal((await prisma.user.findFirstOrThrow()).id, player.id);
  assert.equal((await prisma.wallet.findUniqueOrThrow({ where: { userId: player.id } })).balance, 0);
  assert.equal(await prisma.fighter.count(), 0);
  assert.equal(await prisma.fight.count(), 0);
  assert.equal(await prisma.event.count(), 0);
  assert.equal(await prisma.cardInstance.count(), 0);
  assert.equal(await prisma.cardSet.count(), 1);
  assert.equal(await prisma.cardDefinition.count(), 2);
  assert.equal(await prisma.cardImage.count(), 1);
  assert.equal(await prisma.cardDefinition.count({ where: { fighterId: { not: null } } }), 0);
  assert.equal(await prisma.packDefinition.count(), 1);
  assert.equal(await prisma.adminAuditEntry.count({ where: { action: "TESTING_DATA_RESET", actorId: player.id } }), 1);

  process.stdout.write("Database integration passed: migrations, concurrent casino, betting, pack, marketplace, fight requests, result records, upset rankings, Discord notification scheduling, protected testing reset, preserved card catalog, rewards, ledgers, ownership, duplicates, constraints, roles, home content, and live events.\n");
} finally {
  await servicePrisma?.$disconnect();
  await prisma?.$disconnect();
  await postgres.stop().catch(() => undefined);
  await rm(databaseDir, { recursive: true, force: true });
}
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exitCode = 1;
});
