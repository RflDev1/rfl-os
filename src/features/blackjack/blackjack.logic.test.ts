import { describe, expect, it } from "vitest";
import { blackjackPayout, createDeck, handValue, isBlackjack, playDealer, settledOutcome, type Card } from "./blackjack.logic";

describe("Blackjack rules", () => {
  it("builds one unique 52-card deck", () => {
    const deck = createDeck();
    expect(deck).toHaveLength(52);
    expect(new Set(deck)).toHaveLength(52);
  });
  it("scores hard and soft aces correctly", () => {
    expect(handValue(["AS", "6H"])).toEqual({ total: 17, soft: true });
    expect(handValue(["AS", "6H", "KD"])).toEqual({ total: 17, soft: false });
    expect(handValue(["AS", "AH", "9D"])).toEqual({ total: 21, soft: true });
  });
  it("recognizes a natural only on two cards", () => {
    expect(isBlackjack(["AS", "KH"])).toBe(true);
    expect(isBlackjack(["AS", "5H", "5D"])).toBe(false);
  });
  it("makes the dealer stand on soft 17", () => {
    const cards: Card[] = ["AS", "6H"];
    playDealer(cards, ["KD"]);
    expect(cards).toEqual(["AS", "6H"]);
  });
  it("settles wins, busts, pushes, and natural payouts", () => {
    expect(settledOutcome(["10S", "8H"], ["10D", "7C"])).toBe("PLAYER_WIN");
    expect(settledOutcome(["10S", "8H"], ["10D", "8C"])).toBe("PUSH");
    expect(settledOutcome(["10S", "8H", "9C"], ["10D", "7C"])).toBe("PLAYER_BUST");
    expect(blackjackPayout("PLAYER_BLACKJACK", 100, 20_000, 25_000)).toBe(250);
    expect(blackjackPayout("PUSH", 100, 20_000, 25_000)).toBe(100);
  });
});

