import type { Card } from "@/features/blackjack/blackjack.logic";

const values: Record<string, number> = { "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8, "9": 9, "10": 10, J: 11, Q: 12, K: 13, A: 14 };

export function cardValue(card: Card) {
  return values[card.slice(0, -1)] ?? 0;
}

export function highLowResult(previous: Card, revealed: Card, guess: "HIGHER" | "LOWER") {
  const before = cardValue(previous);
  const after = cardValue(revealed);
  if (before === after) return "TIE" as const;
  const correct = guess === "HIGHER" ? after > before : after < before;
  return correct ? "CORRECT" as const : "WRONG" as const;
}

export function highLowPayout(wager: number, multiplierBps: number) {
  return Math.floor(wager * multiplierBps / 10_000);
}

export function multiplierLabel(multiplierBps: number) {
  return `${(multiplierBps / 10_000).toFixed(2).replace(/0+$/, "").replace(/\.$/, "")}×`;
}

export function nextHighLowMultiplier(currentMultiplierBps: number, card: Card, guess: "HIGHER" | "LOWER", targetReturnBps: number) {
  const value = cardValue(card);
  const winningRanks = guess === "HIGHER" ? 14 - value : value - 2;
  if (winningRanks <= 0) return null;
  const stepFactorBps = Math.floor(targetReturnBps * 13 / winningRanks);
  return Math.floor(currentMultiplierBps * stepFactorBps / 10_000);
}
