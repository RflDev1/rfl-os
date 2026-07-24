import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { hasAdminAccess, hasAdminSectionAccess, hasControlCenterAccess, type AdminSection } from "./authorization.logic";

export async function requireAdmin() {
  const session = await auth();
  if (!session) redirect("/signin");
  if (!hasAdminAccess(session.user)) {
    redirect("/play");
  }
  return session;
}

export async function requireControlCenter() {
  const session = await auth();
  if (!session) redirect("/signin");
  if (!hasControlCenterAccess(session.user)) redirect("/play");
  return session;
}

export async function requireAdminSection(section: AdminSection) {
  const session = await auth();
  if (!session) redirect("/signin");
  if (!hasAdminSectionAccess(session.user, section)) redirect("/play");
  return session;
}
