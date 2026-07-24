import { describe, expect, it } from "vitest";
import { announcementSchema, eventSchema, fightSchema, fighterSchema } from "./home.schema";

describe("home content validation", () => {
  it("accepts a production-shaped scheduled event", () => {
    const result = eventSchema.safeParse({
      title: "RFL Opening Night",
      subtitle: "The first chapter begins.",
      venue: "The Realm Arena",
      startsAt: "2026-08-15T20:00:00-05:00",
      status: "SCHEDULED",
      featured: "on",
    });
    expect(result.success).toBe(true);
  });

  it("requires an explicit timezone for event scheduling", () => {
    expect(eventSchema.safeParse({ title: "RFL Night", startsAt: "2026-08-15T20:00", status: "SCHEDULED" }).success).toBe(false);
  });

  it("prevents a fighter from facing themselves", () => {
    expect(fightSchema.safeParse({ eventId: "event", redFighterId: "same", blueFighterId: "same", position: 1 }).success).toBe(false);
  });

  it("keeps fighter records nonnegative", () => {
    expect(fighterSchema.safeParse({ name: "A Fighter", wins: -1, losses: 0, draws: 0 }).success).toBe(false);
  });

  it("allows only internal announcement links", () => {
    expect(announcementSchema.safeParse({ message: "Watch now", linkLabel: "Open", linkUrl: "https://bad.example" }).success).toBe(false);
    expect(announcementSchema.safeParse({ message: "Watch now", linkLabel: "Open", linkUrl: "/play" }).success).toBe(true);
  });
});

