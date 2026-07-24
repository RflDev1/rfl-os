import { describe, expect, it } from "vitest";
import { testingResetSchema } from "./testing-reset.schema";

describe("testing reset confirmation", () => {
  it("requires the exact phrase and acknowledgement", () => {
    expect(testingResetSchema.safeParse({ confirmation: "RESET PLAYRFL", acknowledge: "on" }).success).toBe(true);
    expect(testingResetSchema.safeParse({ confirmation: "reset playrfl", acknowledge: "on" }).success).toBe(false);
    expect(testingResetSchema.safeParse({ confirmation: "RESET PLAYRFL" }).success).toBe(false);
  });
});
