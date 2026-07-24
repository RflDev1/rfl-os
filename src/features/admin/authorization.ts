import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getEnv } from "@/lib/env";
import { prisma } from "@/lib/prisma";
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

export async function requireOwner() {
  const session = await auth();
  if (!session) redirect("/signin");
  const ownerDiscordId = getEnv().BOOTSTRAP_ADMIN_DISCORD_ID;
  if (!ownerDiscordId) redirect("/play");
  const ownerAccount = await prisma.account.findFirst({
    where: {
      userId: session.user.id,
      provider: "discord",
      providerAccountId: ownerDiscordId,
    },
    select: { userId: true },
  });
  if (!ownerAccount) redirect("/play");
  return session;
}
