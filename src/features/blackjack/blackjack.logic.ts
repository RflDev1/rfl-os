import { randomInt } from "node:crypto";
import type { BlackjackOutcome } from "@/generated/prisma/client";

export const suits = ["S", "H", "D", "C"] as const;
export const ranks = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"] as const;
export type Card = `${typeof ranks[number]}${typeof suits[number]}`;

export function createDeck(): Card[] {
  return suits.flatMap((suit) => ranks.map((rank) => `${rank}${suit}` as Card));
}

export function shuffledDeck(): Card[] {
  const deck = createDeck();
  for (let index = deck.length - 1; index > 0; index -= 1) {
    const swap = randomInt(index + 1);
    [deck[index], deck[swap]] = [deck[swap], deck[index]];
  }
  return deck;
}

export function draw(deck: Card[]) {
  const card = deck.pop();
  if (!card) throw new Error("Blackjack deck exhausted.");
  return card;
}

export function handValue(cards: Card[]) {
  let total = 0;
  let aces = 0;
  for (const card of cards) {
    const rank = card.slice(0, -1);
    if (rank === "A") {
      aces += 1;
      total += 11;
    } else if (["K", "Q", "J"].includes(rank)) {
      total += 10;
    } else {
      total += Number(rank);
    }
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces -= 1;
  }
  return { total, soft: aces > 0 };
}

export function isBlackjack(cards: Card[]) {
  return cards.length === 2 && handValue(cards).total === 21;
}

export function playDealer(cards: Card[], deck: Card[]) {
  while (handValue(cards).total < 17) cards.push(draw(deck));
  return cards;
}

export function settledOutcome(player: Card[], dealer: Card[]): BlackjackOutcome {
  const playerTotal = handValue(player).total;
  const dealerTotal = handValue(dealer).total;
  if (playerTotal > 21) return "PLAYER_BUST";
  if (isBlackjack(player) && !isBlackjack(dealer)) return "PLAYER_BLACKJACK";
  if (isBlackjack(dealer) && !isBlackjack(player)) return "DEALER_WIN";
  if (dealerTotal > 21) return "DEALER_BUST";
  if (playerTotal > dealerTotal) return "PLAYER_WIN";
  if (dealerTotal > playerTotal) return "DEALER_WIN";
  return "PUSH";
}

export function blackjackPayout(
  outcome: BlackjackOutcome,
  totalWager: number,
  normalPayoutBps: number,
  naturalPayoutBps: number,
) {
  if (outcome === "PUSH") return totalWager;
  if (outcome === "PLAYER_BLACKJACK") return Math.floor(totalWager * naturalPayoutBps / 10_000);
  if (outcome === "PLAYER_WIN" || outcome === "DEALER_BUST") return Math.floor(totalWager * normalPayoutBps / 10_000);
  return 0;
}

export function blackjackReturnLabel(payoutBasisPoints: number) {
  const multiplier = payoutBasisPoints / 10_000;
  return `${Number.isInteger(multiplier) ? multiplier.toFixed(0) : multiplier.toFixed(2).replace(/0$/, "")}×`;
}

export function cardParts(card: Card) {
  return { rank: card.slice(0, -1), suit: card.slice(-1) as typeof suits[number] };
}
