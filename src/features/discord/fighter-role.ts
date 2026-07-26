import { prisma } from "@/lib/prisma";
import { discordApi } from "./discord-api";

const FIGHTER_ROLE_NAME = "RFL Fighter";

type ApiConfig = {
  apiBaseUrl: string;
  botToken: string;
  guildId: string;
};

type DiscordRole = {
  id: string;
  name: string;
  managed: boolean;
};

export async function ensureFighterDiscordRole(config: ApiConfig) {
  const roles = await discordApi<DiscordRole[]>(`/guilds/${config.guildId}/roles`, config);
  const existing = roles.find((role) =>
    !role.managed && [FIGHTER_ROLE_NAME, "Fighter"].includes(role.name)
  );
  if (existing) return existing;

  return discordApi<DiscordRole>(`/guilds/${config.guildId}/roles`, config, {
    method: "POST",
    body: {
      name: FIGHTER_ROLE_NAME,
      color: 0x7c3aed,
      hoist: true,
      mentionable: false,
    },
  });
}

export async function setDiscordFighterRole(
  config: ApiConfig,
  discordUserId: string,
  active: boolean,
) {
  const role = await ensureFighterDiscordRole(config);
  await discordApi<void>(
    `/guilds/${config.guildId}/members/${discordUserId}/roles/${role.id}`,
    config,
    { method: active ? "PUT" : "DELETE" },
  );
}

export async function syncUserFighterRole(config: ApiConfig, userId: string, active: boolean) {
  const account = await prisma.account.findFirst({
    where: { userId, provider: "discord" },
    select: { providerAccountId: true },
  });
  if (!account) return false;
  await setDiscordFighterRole(config, account.providerAccountId, active);
  return true;
}
