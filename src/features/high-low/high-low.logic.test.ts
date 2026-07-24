import { describe, expect, it } from "vitest";
import { cardValue, highLowPayout, highLowResult, multiplierLabel, nextHighLowMultiplier } from "./high-low.logic";

describe("High-Low rules", () => {
  it("treats Ace as high and compares ranks only", () => {
    expect(cardValue("AS")).toBe(14);
    expect(highLowResult("10H", "AS", "HIGHER")).toBe("CORRECT");
    expect(highLowResult("KD", "2C", "LOWER")).toBe("CORRECT");
  });
  it("treats equal ranks as a losing tie", () => expect(highLowResult("7H", "7S", "HIGHER")).toBe("TIE"));
  it("calculates whole-Crown cashout values", () => {
    expect(highLowPayout(100, 13_000)).toBe(130);
    expect(multiplierLabel(13_000)).toBe("1.3×");
  });
  it("prices the next return by the chosen rank probability", () => {
    expect(nextHighLowMultiplier(10_000, "AS", "HIGHER", 9_500)).toBeNull();
    expect(nextHighLowMultiplier(10_000, "AS", "LOWER", 9_500)).toBe(10_291);
    expect(nextHighLowMultiplier(10_000, "7S", "HIGHER", 9_500)).toBe(17_642);
  });
});
