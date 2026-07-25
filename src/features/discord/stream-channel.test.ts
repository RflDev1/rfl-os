import { describe, expect, it } from "vitest";
import { streamChannelName } from "./stream-channel-name";

describe("Fight Stream voice-channel name", () => {
  it("uses the live event title first", () => {
    expect(streamChannelName({
      now: new Date("2026-07-25T12:00:00Z"),
      liveTitle: "RFL 001",
      upcoming: { title: "RFL 002", startsAt: new Date("2026-07-25T20:00:00Z") },
    })).toBe("RFL 001");
  });

  it("shows a same-day Central Time event", () => {
    expect(streamChannelName({
      now: new Date("2026-07-25T15:00:00Z"),
      upcoming: { title: "RFL 001", startsAt: new Date("2026-07-25T20:00:00Z") },
    })).toBe("RFL 001 @ 3:00 PM CT");
  });

  it("returns to Fight Stream when the next event is not today", () => {
    expect(streamChannelName({
      now: new Date("2026-07-25T15:00:00Z"),
      upcoming: { title: "RFL 002", startsAt: new Date("2026-07-26T20:00:00Z") },
    })).toBe("Fight Stream");
  });
});
