import { describe, expect, it } from "vitest";
import { fightStateSchema, liveUpdateSchema } from "./live.schema";

describe("live operations", () => {
  it("requires a result to complete a fight", () => {
    expect(fightStateSchema.safeParse({ fightId: "fight", status: "COMPLETED", resultSummary: "Decision" }).success).toBe(false);
    expect(fightStateSchema.safeParse({ fightId: "fight", status: "COMPLETED", result: "RED_WIN", resultSummary: "Decision" }).success).toBe(true);
  });
  it("keeps public updates concise", () => {
    expect(liveUpdateSchema.safeParse({ eventId: "event", kind: "FIGHT", message: "Round one begins." }).success).toBe(true);
    expect(liveUpdateSchema.safeParse({ eventId: "event", kind: "FIGHT", message: "x".repeat(281) }).success).toBe(false);
  });
});

