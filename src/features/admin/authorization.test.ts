import { describe, expect, it } from "vitest";
import { hasAdminAccess } from "./authorization.logic";

describe("admin authorization", () => {
  it("requires both active status and the admin role", () => {
    expect(hasAdminAccess({ status: "ACTIVE", roles: ["PLAYER", "ADMIN"] })).toBe(true);
    expect(hasAdminAccess({ status: "ACTIVE", roles: ["PLAYER", "MODERATOR"] })).toBe(false);
    expect(hasAdminAccess({ status: "SUSPENDED", roles: ["ADMIN"] })).toBe(false);
  });
});
