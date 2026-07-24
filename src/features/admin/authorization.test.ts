import { describe, expect, it } from "vitest";
import { hasAdminAccess, hasAdminSectionAccess, hasControlCenterAccess } from "./authorization.logic";

describe("admin authorization", () => {
  it("requires both active status and the admin role", () => {
    expect(hasAdminAccess({ status: "ACTIVE", roles: ["PLAYER", "ADMIN"] })).toBe(true);
    expect(hasAdminAccess({ status: "ACTIVE", roles: ["PLAYER", "MODERATOR"] })).toBe(false);
    expect(hasAdminAccess({ status: "SUSPENDED", roles: ["ADMIN"] })).toBe(false);
  });

  it("limits fighter analysts to approved control-center sections", () => {
    const analyst = { status: "ACTIVE", roles: ["PLAYER", "FIGHTER_ANALYST"] };
    expect(hasAdminAccess(analyst)).toBe(false);
    expect(hasControlCenterAccess(analyst)).toBe(true);
    expect(hasAdminSectionAccess(analyst, "CONTENT")).toBe(true);
    expect(hasAdminSectionAccess({ ...analyst, status: "SUSPENDED" }, "CONTENT")).toBe(false);
  });
});
