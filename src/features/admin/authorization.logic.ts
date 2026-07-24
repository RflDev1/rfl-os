export function hasAdminAccess(user: { status: string; roles: readonly string[] }) {
  return user.status === "ACTIVE" && user.roles.includes("ADMIN");
}
