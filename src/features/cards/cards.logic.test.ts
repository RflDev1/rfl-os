import { describe, expect, it } from "vitest";
import { pickRarity, rarityRates } from "./cards.logic";

const weights = { COMMON: 70, RARE: 22, EPIC: 7, LEGENDARY: 1 };

describe("card drop tables", () => {
  it("publishes normalized rates", () => {
    expect(rarityRates(weights)).toEqual({ COMMON: 0.7, RARE: 0.22, EPIC: 0.07, LEGENDARY: 0.01 });
  });

  it("selects deterministic rarity boundaries", () => {
    expect(pickRarity(weights, () => 0)).toBe("COMMON");
    expect(pickRarity(weights, () => 70)).toBe("RARE");
    expect(pickRarity(weights, () => 92)).toBe("EPIC");
    expect(pickRarity(weights, () => 99)).toBe("LEGENDARY");
  });
});
