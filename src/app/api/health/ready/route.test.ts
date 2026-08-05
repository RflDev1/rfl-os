import { beforeEach, describe, expect, it, vi } from "vitest";

const queryRaw = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: { $queryRaw: queryRaw },
}));

describe("readiness endpoint", () => {
  beforeEach(() => {
    vi.resetModules();
    queryRaw.mockReset();
  });

  it("coalesces and caches concurrent database checks", async () => {
    queryRaw.mockResolvedValue([{ ok: 1 }]);
    const { GET } = await import("./route");

    const responses = await Promise.all(Array.from({ length: 20 }, () => GET()));

    expect(responses.every((response) => response.status === 200)).toBe(true);
    expect(queryRaw).toHaveBeenCalledTimes(1);
    expect(responses[0]?.headers.get("cache-control")).toBe("no-store");
  });
});
