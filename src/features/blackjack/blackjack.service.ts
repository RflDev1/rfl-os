import { Prisma, type BlackjackMove } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  blackjackPayout,
  draw,
  handValue,
  isBlackjack,
  playDealer,
  settledOutcome,
  shuffledDeck,
  type Card,
} from "./blackjack.logic";

export class BlackjackFundsError extends Error {}
export class BlackjackMoveError extends Error {}
export class BlackjackRateLimitError extends Error {}

type Rules = {
  payoutBasisPoints: number;
  blackjackPayoutBps: number;
  maxRoundsPerMinute: number;
};

function cards(value: Prisma.JsonValue): Card[] {
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) {
    throw new Error("Stored Blackjack cards are invalid.");
  }
  return [...value] as Card[];
}

async function lockPlayer(tx: Prisma.TransactionClient, userId: string) {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${userId})) IS NULL AS "locked"`;
}

export async function startBlackjack(
  input: { userId: string; wager: number; idempotencyKey: string } & Rules,
  deckFactory: () => Card[] = shuffledDeck,
) {
  const preparedDeck = deckFactory();

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await prisma.$transaction(async (tx) => {
        await lockPlayer(tx, input.userId);
        const replay = await tx.blackjackRound.findUnique({
          where: { userId_idempotencyKey: { userId: input.userId, idempotencyKey: input.idempotencyKey } },
        });
        if (replay) return { ...replay, replayed: true };
        const active = await tx.blackjackRound.findFirst({ where: { userId: input.userId, status: "ACTIVE" } });
        if (active) return { ...active, replayed: true };

        const recent = await tx.blackjackRound.count({
          where: { userId: input.userId, createdAt: { gt: new Date(Date.now() - 60_000) } },
        });
        if (recent >= input.maxRoundsPerMinute) throw new BlackjackRateLimitError("Blackjack rate limit reached.");
        const wallet = await tx.wallet.findUnique({ where: { userId: input.userId } });
        if (!wallet || wallet.balance < input.wager) throw new BlackjackFundsError("Not enough Crowns.");

        const deck = [...preparedDeck];
        const playerCards = [draw(deck)];
        const dealerCards = [draw(deck)];
        playerCards.push(draw(deck));
        dealerCards.push(draw(deck));
        const immediatelySettled = isBlackjack(playerCards) || isBlackjack(dealerCards);
        const outcome = immediatelySettled ? settledOutcome(playerCards, dealerCards) : null;
        const payout = outcome ? blackjackPayout(outcome, input.wager, input.payoutBasisPoints, input.blackjackPayoutBps) : 0;
        const balanceAfterWager = wallet.balance - input.wager;
        const balanceAfter = balanceAfterWager + payout;

        await tx.wallet.update({ where: { id: wallet.id }, data: { balance: balanceAfter, version: { increment: 1 } } });
        const round = await tx.blackjackRound.create({
          data: {
            userId: input.userId,
            wager: input.wager,
            totalWager: input.wager,
            payout,
            balanceAfter,
            status: outcome ? "SETTLED" : "ACTIVE",
            outcome,
            deck,
            playerCards,
            dealerCards,
            payoutBasisPoints: input.payoutBasisPoints,
            blackjackPayoutBps: input.blackjackPayoutBps,
            idempotencyKey: input.idempotencyKey,
            settledAt: outcome ? new Date() : null,
            actions: { create: { move: "DEAL", idempotencyKey: `${input.idempotencyKey}:deal` } },
          },
        });
        await tx.walletEntry.create({
          data: {
            walletId: wallet.id,
            delta: -input.wager,
            balanceAfter: balanceAfterWager,
            reason: "BLACKJACK_WAGER",
            referenceId: round.id,
            idempotencyKey: `${input.idempotencyKey}:wager`,
          },
        });
        if (payout > 0) {
          await tx.walletEntry.create({
            data: {
              walletId: wallet.id,
              delta: payout,
              balanceAfter,
              reason: "BLACKJACK_PAYOUT",
              referenceId: round.id,
              idempotencyKey: `${input.idempotencyKey}:payout`,
            },
          });
        }
        return { ...round, replayed: false };
      }, { isolationLevel: "Serializable" });
    } catch (error) {
      if (error instanceof BlackjackFundsError || error instanceof BlackjackRateLimitError) throw error;
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034" && attempt < 2) continue;
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const replay = await prisma.blackjackRound.findUnique({
          where: { userId_idempotencyKey: { userId: input.userId, idempotencyKey: input.idempotencyKey } },
        });
        if (replay) return { ...replay, replayed: true };
      }
      throw error;
    }
  }
  throw new Error("Blackjack could not start after retrying.");
}

export async function actBlackjack(input: {
  userId: string;
  roundId: string;
  move: Exclude<BlackjackMove, "DEAL">;
  idempotencyKey: string;
}) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await prisma.$transaction(async (tx) => {
        await lockPlayer(tx, input.userId);
        const round = await tx.blackjackRound.findFirst({ where: { id: input.roundId, userId: input.userId } });
        if (!round) throw new BlackjackMoveError("Round not found.");
        const replay = await tx.blackjackAction.findUnique({
          where: { roundId_idempotencyKey: { roundId: round.id, idempotencyKey: input.idempotencyKey } },
        });
        if (replay || round.status === "SETTLED") return { ...round, replayed: true };

        const deck = cards(round.deck);
        const playerCards = cards(round.playerCards);
        const dealerCards = cards(round.dealerCards);
        const wallet = await tx.wallet.findUniqueOrThrow({ where: { userId: input.userId } });
        let additionalWager = 0;
        let outcome = null as ReturnType<typeof settledOutcome> | null;

        if (input.move === "HIT") {
          playerCards.push(draw(deck));
          if (handValue(playerCards).total > 21) outcome = "PLAYER_BUST";
          else if (handValue(playerCards).total === 21) {
            playDealer(dealerCards, deck);
            outcome = settledOutcome(playerCards, dealerCards);
          }
        } else if (input.move === "STAND") {
          playDealer(dealerCards, deck);
          outcome = settledOutcome(playerCards, dealerCards);
        } else if (input.move === "DOUBLE") {
          if (playerCards.length !== 2 || round.totalWager !== round.wager) throw new BlackjackMoveError("Double is only available on the first two cards.");
          if (wallet.balance < round.wager) throw new BlackjackFundsError("Not enough Crowns to double.");
          additionalWager = round.wager;
          playerCards.push(draw(deck));
          if (handValue(playerCards).total > 21) outcome = "PLAYER_BUST";
          else {
            playDealer(dealerCards, deck);
            outcome = settledOutcome(playerCards, dealerCards);
          }
        }

        const totalWager = round.totalWager + additionalWager;
        const payout = outcome ? blackjackPayout(outcome, totalWager, round.payoutBasisPoints, round.blackjackPayoutBps) : 0;
        const balanceAfterWager = wallet.balance - additionalWager;
        const balanceAfter = balanceAfterWager + payout;
        if (additionalWager > 0 || payout > 0) {
          await tx.wallet.update({ where: { id: wallet.id }, data: { balance: balanceAfter, version: { increment: 1 } } });
        }
        await tx.blackjackAction.create({ data: { roundId: round.id, move: input.move, idempotencyKey: input.idempotencyKey } });
        const updated = await tx.blackjackRound.update({
          where: { id: round.id },
          data: {
            deck,
            playerCards,
            dealerCards,
            totalWager,
            payout,
            balanceAfter,
            status: outcome ? "SETTLED" : "ACTIVE",
            outcome,
            settledAt: outcome ? new Date() : null,
            version: { increment: 1 },
          },
        });
        if (additionalWager > 0) {
          await tx.walletEntry.create({
            data: {
              walletId: wallet.id,
              delta: -additionalWager,
              balanceAfter: balanceAfterWager,
              reason: "BLACKJACK_WAGER",
              referenceId: round.id,
              idempotencyKey: `${input.idempotencyKey}:double`,
            },
          });
        }
        if (payout > 0) {
          await tx.walletEntry.create({
            data: {
              walletId: wallet.id,
              delta: payout,
              balanceAfter,
              reason: "BLACKJACK_PAYOUT",
              referenceId: round.id,
              idempotencyKey: `${input.idempotencyKey}:payout`,
            },
          });
        }
        return { ...updated, replayed: false };
      }, { isolationLevel: "Serializable" });
    } catch (error) {
      if (error instanceof BlackjackFundsError || error instanceof BlackjackMoveError) throw error;
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034" && attempt < 2) continue;
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const round = await prisma.blackjackRound.findFirst({ where: { id: input.roundId, userId: input.userId } });
        if (round) return { ...round, replayed: true };
      }
      throw error;
    }
  }
  throw new Error("Blackjack action could not settle after retrying.");
}

export function publicRound(round: {
  id: string;
  status: "ACTIVE" | "SETTLED";
  outcome: Prisma.JsonValue | string | null;
  playerCards: Prisma.JsonValue;
  dealerCards: Prisma.JsonValue;
  wager: number;
  totalWager: number;
  payout: number;
  balanceAfter: number;
}) {
  const playerCards = cards(round.playerCards);
  const allDealerCards = cards(round.dealerCards);
  return {
    roundId: round.id,
    status: round.status,
    outcome: round.outcome as string | null,
    playerCards,
    dealerCards: round.status === "ACTIVE" ? [allDealerCards[0], null] : allDealerCards,
    playerTotal: handValue(playerCards).total,
    dealerTotal: round.status === "ACTIVE" ? handValue([allDealerCards[0]]).total : handValue(allDealerCards).total,
    wager: round.wager,
    totalWager: round.totalWager,
    payout: round.payout,
    balance: round.balanceAfter,
    canDouble: round.status === "ACTIVE" && playerCards.length === 2 && round.totalWager === round.wager,
  };
}
