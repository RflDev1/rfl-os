import { PrismaAdapter } from "@auth/prisma-adapter";
import NextAuth from "next-auth";
import Discord from "next-auth/providers/discord";
import { prisma } from "@/lib/prisma";
import { getEnv } from "@/lib/env";

const env = getEnv();

async function requireRflGuildMembership(discordUserId: string, accessToken?: string) {
  if (!env.DISCORD_GUILD_ID || !accessToken) {
    console.error("[rfl-auth] Discord membership denied", {
      reason: !env.DISCORD_GUILD_ID ? "missing_guild_id" : "missing_oauth_access_token",
    });
    return false;
  }
  try {
    const response = await fetch(`${env.DISCORD_API_BASE_URL}/guilds/${env.DISCORD_GUILD_ID}/members/${discordUserId}`, {
      method: "PUT",
      headers: {
        Authorization: `Bot ${env.DISCORD_BOT_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ access_token: accessToken }),
      cache: "no-store",
    });
    if (response.status === 201 || response.status === 204) return true;
    const error = await response.json().catch(() => null) as { code?: number; message?: string } | null;
    console.error("[rfl-auth] Discord membership denied", {
      reason: "discord_api_rejected",
      status: response.status,
      code: error?.code,
      message: error?.message,
    });
    return false;
  } catch (error) {
    console.error("[rfl-auth] Discord membership denied", {
      reason: "discord_api_unreachable",
      message: error instanceof Error ? error.message : "Unknown network error",
    });
    return false;
  }
}

async function syncFighterAnalystRole(userId: string, discordUserId: string) {
  if (!env.DISCORD_GUILD_ID || !env.FIGHTER_ANALYST_DISCORD_ROLE_ID) return;
  const response = await fetch(`${env.DISCORD_API_BASE_URL}/guilds/${env.DISCORD_GUILD_ID}/members/${discordUserId}`, {
    headers: { Authorization: `Bot ${env.DISCORD_BOT_TOKEN}` },
    cache: "no-store",
  });
  if (!response.ok) return;
  const member = await response.json() as { roles?: string[] };
  const hasRole = member.roles?.includes(env.FIGHTER_ANALYST_DISCORD_ROLE_ID) ?? false;
  if (hasRole) {
    await prisma.userRole.upsert({
      where: { userId_role: { userId, role: "FIGHTER_ANALYST" } },
      update: {},
      create: { userId, role: "FIGHTER_ANALYST" },
    });
  } else {
    await prisma.userRole.deleteMany({ where: { userId, role: "FIGHTER_ANALYST" } });
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "database" },
  providers: [
    Discord({
      clientId: env.DISCORD_CLIENT_ID,
      clientSecret: env.DISCORD_CLIENT_SECRET,
      authorization: { params: { scope: "identify guilds.join" } },
    }),
  ],
  pages: { signIn: "/signin", error: "/signin" },
  trustHost: true,
  callbacks: {
    async signIn({ user, account }) {
      if (!user.id) return false;
      if (
        account?.provider === "discord" &&
        !(await requireRflGuildMembership(account.providerAccountId, account.access_token))
      ) {
        return false;
      }
      const storedUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { status: true },
      });
      if (storedUser?.status === "SUSPENDED" || storedUser?.status === "DEACTIVATED") {
        console.error("[rfl-auth] Account status denied sign-in", { status: storedUser.status });
        return false;
      }

      if (
        storedUser &&
        account?.provider === "discord" &&
        env.BOOTSTRAP_ADMIN_DISCORD_ID === account.providerAccountId
      ) {
        await prisma.userRole.upsert({
          where: { userId_role: { userId: user.id, role: "ADMIN" } },
          update: {},
          create: { userId: user.id, role: "ADMIN" },
        });
      }
      if (storedUser && account?.provider === "discord") {
        await syncFighterAnalystRole(user.id, account.providerAccountId);
      }

      return true;
    },
    async session({ session, user }) {
      const account = await prisma.user.findUnique({
        where: { id: user.id },
        include: { roles: { select: { role: true } }, wallet: true },
      });

      if (!account) return session;
      session.user.id = account.id;
      session.user.displayName = account.displayName;
      session.user.status = account.status;
      session.user.profileCompletedAt = account.profileCompletedAt;
      session.user.roles = account.roles.map(({ role }) => role);
      session.user.walletBalance = account.wallet?.balance ?? 0;
      return session;
    },
    async redirect({ url }) {
      const origin = new URL(env.APP_URL);
      if (url.startsWith("/")) return new URL(url, origin).toString();
      const destination = new URL(url);
      return destination.origin === origin.origin ? destination.toString() : origin.toString();
    },
  },
  events: {
    async createUser({ user }) {
      if (!user.id) throw new Error("Auth adapter created a user without an ID.");
      const userId = user.id;
      await prisma.$transaction([
        prisma.wallet.upsert({
          where: { userId },
          update: {},
          create: { userId },
        }),
        prisma.userRole.upsert({
          where: { userId_role: { userId, role: "PLAYER" } },
          update: {},
          create: { userId, role: "PLAYER" },
        }),
      ]);
    },
    async linkAccount({ account }) {
      await prisma.$transaction(async (tx) => {
        await tx.account.update({
          where: {
            provider_providerAccountId: {
              provider: account.provider,
              providerAccountId: account.providerAccountId,
            },
          },
          data: { access_token: null, refresh_token: null, id_token: null },
        });

        if (
          account.userId &&
          account.provider === "discord" &&
          env.BOOTSTRAP_ADMIN_DISCORD_ID === account.providerAccountId
        ) {
          const userId = account.userId;
          await tx.userRole.upsert({
            where: { userId_role: { userId, role: "ADMIN" } },
            update: {},
            create: { userId, role: "ADMIN" },
          });
        }
      });
      if (account.userId && account.provider === "discord") {
        await syncFighterAnalystRole(account.userId, account.providerAccountId);
      }
    },
  },
});
