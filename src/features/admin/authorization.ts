import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { hasAdminAccess } from "./authorization.logic";

export async function requireAdmin() {
  const session = await auth();
  if (!session) redirect("/signin");
  if (!hasAdminAccess(session.user)) {
    redirect("/play");
  }
  return session;
}
