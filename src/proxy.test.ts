import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { clearRequestRateLimitsForTests } from "@/lib/request-rate-limit";
import { proxy } from "./proxy";

const emergency = vi.hoisted(() => ({
  activate: vi.fn().mockResolvedValue(undefined),
  isLocked: vi.fn().mockResolvedValue(false),
}));

vi.mock("@/lib/emergency-lockdown", () => ({
  activateEmergencyLockdown: emergency.activate,
  isEmergencyLocked: emergency.isLocked,
}));

describe("request proxy limits", () => {
  beforeEach(() => {
    clearRequestRateLimitsForTests();
    emergency.activate.mockClear();
    emergency.isLocked.mockReset().mockResolvedValue(false);
  });

  it("uses DigitalOcean's client IP before forwarded proxy addresses", async () => {
    let lastStatus = 0;
    for (let index = 0; index < 181; index += 1) {
      const request = new NextRequest("https://playrfl.com/fighters", {
        headers: {
          "do-connecting-ip": "203.0.113.10",
          "x-forwarded-for": `198.51.100.${index % 250}`,
        },
      });
      lastStatus = (await proxy(request)).status;
    }

    expect(lastStatus).toBe(429);
  });

  it("never locks platform health probes out", async () => {
    for (let index = 0; index < 3_001; index += 1) {
      await proxy(new NextRequest("https://playrfl.com/"));
    }

    expect((await proxy(new NextRequest("https://playrfl.com/api/health/live"))).status).toBe(200);
    expect((await proxy(new NextRequest("https://playrfl.com/api/health/ready"))).status).toBe(200);
    expect(emergency.activate).toHaveBeenCalledOnce();
  });

  it("blocks public traffic while preserving signed Discord recovery", async () => {
    emergency.isLocked.mockResolvedValue(true);

    expect((await proxy(new NextRequest("https://playrfl.com/"))).status).toBe(503);
    expect((await proxy(new NextRequest("https://playrfl.com/api/auth/session"))).status).toBe(503);
    expect((await proxy(new NextRequest("https://playrfl.com/api/discord/interactions"))).status).toBe(200);
  });
});
