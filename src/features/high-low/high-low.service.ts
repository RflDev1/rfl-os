import { Prisma, type HighLowGuess } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { draw, shuffledDeck, type Card } from "@/features/blackjack/blackjack.logic";
import { highLowPayout, highLowResult, nextHighLowMultiplier } from "./high-low.logic";

export class HighLowFundsError extends Error {}
export class HighLowMoveError extends Error {}
export class HighLowRateLimitError extends Error {}

function cards(value: Prisma.JsonValue): Card[] {
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) throw new Error("Stored High-Low deck is invalid.");
  return [...value] as Card[];
}

async function lockPlayer(tx: Prisma.TransactionClient, userId: string) {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${userId})) IS NULL AS "locked"`;
}

export async function startHighLow(
  input: { userId: string; wager: number; idempotencyKey: string; targetReturnBps: number; maxSteps: number; maxRoundsPerMinute: number },
  deckFactory: () => Card[] = shuffledDeck,
) {
  const preparedDeck = deckFactory();
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await prisma.$transaction(async (tx) => {
        await lockPlayer(tx, input.userId);
        const replay = await tx.highLowRound.findUnique({ where: { userId_idempotencyKey: { userId: input.userId, idempotencyKey: input.idempotencyKey } }, include: { guesses: { orderBy: { createdAt: "asc" } } } });
        if (replay) return { ...replay, replayed: true };
        const active = await tx.highLowRound.findFirst({ where: { userId: input.userId, status: "ACTIVE" }, include: { guesses: { orderBy: { createdAt: "asc" } } } });
        if (active) return { ...active, replayed: true };
        const recent = await tx.highLowRound.count({ where: { userId: input.userId, createdAt: { gt: new Date(Date.now() - 60_000) } } });
        if (recent >= input.maxRoundsPerMinute) throw new HighLowRateLimitError("High-Low rate limit reached.");
        const wallet = await tx.wallet.findUnique({ where: { userId: input.userId } });
        if (!wallet || wallet.balance < input.wager) throw new HighLowFundsError("Not enough Crowns.");

        const deck = [...preparedDeck];
        const currentCard = draw(deck);
        const balanceAfter = wallet.balance - input.wager;
        await tx.wallet.update({ where: { id: wallet.id }, data: { balance: balanceAfter, version: { increment: 1 } } });
        const round = await tx.highLowRound.create({
          data: { userId: input.userId, wager: input.wager, balanceAfter, deck, currentCard, targetReturnBps: input.targetReturnBps, maxSteps: input.maxSteps, idempotencyKey: input.idempotencyKey },
          include: { guesses: true },
        });
        await tx.walletEntry.create({ data: { walletId: wallet.id, delta: -input.wager, balanceAfter, reason: "HIGH_LOW_WAGER", referenceId: round.id, idempotencyKey: `${input.idempotencyKey}:wager` } });
        return { ...round, replayed: false };
      }, { isolationLevel: "Serializable" });
    } catch (error) {
      if (error instanceof HighLowFundsError || error instanceof HighLowRateLimitError) throw error;
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034" && attempt < 2) continue;
      throw error;
    }
  }
  throw new Error("High-Low could not start after retrying.");
}

export async function actHighLow(input: { userId: string; roundId: string; intent: HighLowGuess | "CASH_OUT"; idempotencyKey: string }) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await prisma.$transaction(async (tx) => {
        await lockPlayer(tx, input.userId);
        const round = await tx.highLowRound.findFirst({ where: { id: input.roundId, userId: input.userId }, include: { guesses: { orderBy: { createdAt: "asc" } } } });
        if (!round) throw new HighLowMoveError("Round not found.");
        const replay = await tx.highLowGuessRecord.findUnique({ where: { roundId_idempotencyKey: { roundId: round.id, idempotencyKey: input.idempotencyKey } } });
        if (replay || round.status === "SETTLED") return { ...round, replayed: true };
        if (input.intent === "CASH_OUT" && round.step < 1) throw new HighLowMoveError("Win one guess before cashing out.");

        const deck = cards(round.deck);
        const wallet = await tx.wallet.findUniqueOrThrow({ where: { userId: input.userId } });
        let currentCard = round.currentCard as Card;
        let step = round.step;
        let multiplierBps = round.multiplierBps;
        let outcome = null as "CASHED_OUT" | "WRONG_GUESS" | "TIE" | "MAX_STEPS" | null;
        let revealedCard: Card | null = null;
        let correct: boolean | null = null;

        if (input.intent === "CASH_OUT") {
          outcome = "CASHED_OUT";
        } else {
          revealedCard = draw(deck);
          const result = highLowResult(currentCard, revealedCard, input.intent);
          correct = result === "CORRECT";
          currentCard = revealedCard;
          if (result === "TIE") outcome = "TIE";
          else if (result === "WRONG") outcome = "WRONG_GUESS";
          else {
            step += 1;
            multiplierBps = nextHighLowMultiplier(multiplierBps, round.currentCard as Card, input.intent, round.targetReturnBps)
              ?? multiplierBps;
            if (step >= round.maxSteps) outcome = "MAX_STEPS";
          }
        }

        const payout = outcome === "CASHED_OUT" || outcome === "MAX_STEPS" ? highLowPayout(round.wager, multiplierBps) : 0;
        const balanceAfter = wallet.balance + payout;
        if (payout > 0) await tx.wallet.update({ where: { id: wallet.id }, data: { balance: balanceAfter, version: { increment: 1 } } });
        await tx.highLowGuessRecord.create({
          data: { roundId: round.id, guess: input.intent === "CASH_OUT" ? null : input.intent, previousCard: round.currentCard, revealedCard, correct, multiplierAfterBps: multiplierBps, idempotencyKey: input.idempotencyKey },
        });
        await tx.highLowRound.update({
          where: { id: round.id },
          data: { deck, currentCard, step, multiplierBps, payout, balanceAfter, status: outcome ? "SETTLED" : "ACTIVE", outcome, settledAt: outcome ? new Date() : null },
        });
        if (payout > 0) await tx.walletEntry.create({ data: { walletId: wallet.id, delta: payout, balanceAfter, reason: "HIGH_LOW_PAYOUT", referenceId: round.id, idempotencyKey: `${input.idempotencyKey}:payout` } });
        const updated = await tx.highLowRound.findUniqueOrThrow({ where: { id: round.id }, include: { guesses: { orderBy: { createdAt: "asc" } } } });
        return { ...updated, replayed: false };
      }, { isolationLevel: "Serializable" });
    } catch (error) {
      if (error instanceof HighLowMoveError) throw error;
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034" && attempt < 2) continue;
      throw error;
    }
  }
  throw new Error("High-Low action could not settle after retrying.");
}

export function publicHighLow(round: Awaited<ReturnType<typeof startHighLow>>) {
  return {
    roundId: round.id,
    status: round.status,
    outcome: round.outcome,
    currentCard: round.currentCard,
    step: round.step,
    multiplierBps: round.multiplierBps,
    maxSteps: round.maxSteps,
    wager: round.wager,
    payout: round.payout,
    balance: round.balanceAfter,
    history: round.guesses.filter((guess) => guess.revealedCard).map((guess) => ({ card: guess.revealedCard!, correct: guess.correct! })),
    higherNextBps: nextHighLowMultiplier(round.multiplierBps, round.currentCard as Card, "HIGHER", round.targetReturnBps),
    lowerNextBps: nextHighLowMultiplier(round.multiplierBps, round.currentCard as Card, "LOWER", round.targetReturnBps),
  };
}
