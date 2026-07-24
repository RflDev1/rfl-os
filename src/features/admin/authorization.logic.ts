export type AdminSection = "CONTENT" | "EVENTS" | "RANKINGS" | "BETTING" | "REQUESTS";
const fighterAnalystSections: readonly AdminSection[] = ["CONTENT", "EVENTS", "RANKINGS", "BETTING", "REQUESTS"];

export function hasAdminAccess(user: { status: string; roles: readonly string[] }) {
  return user.status === "ACTIVE" && user.roles.includes("ADMIN");
}

export function hasControlCenterAccess(user: { status: string; roles: readonly string[] }) {
  return user.status === "ACTIVE" && user.roles.some((role) => role === "ADMIN" || role === "FIGHTER_ANALYST");
}

export function hasAdminSectionAccess(user: { status: string; roles: readonly string[] }, section: AdminSection) {
  return hasAdminAccess(user) || (user.status === "ACTIVE" && user.roles.includes("FIGHTER_ANALYST") && fighterAnalystSections.includes(section));
}
