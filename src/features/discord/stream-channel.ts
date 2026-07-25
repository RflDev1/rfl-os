import { discordApi } from "./discord-api";
import { prisma } from "@/lib/prisma";
import { streamChannelName } from "./stream-channel-name";

type DiscordChannel = { id: string; parent_id?: string | null; name: string; type: number };
type Config = { apiBaseUrl: string; botToken: string; guildId: string };

export async function syncFightStreamChannel(config: Config, now = new Date()) {
  const [live, upcoming, channels] = await Promise.all([
    prisma.event.findFirst({
      where: { OR: [{ status: "LIVE" }, { fights: { some: { status: "LIVE" } } }] },
      orderBy: { startsAt: "asc" },
      select: { title: true },
    }),
    prisma.event.findFirst({
      where: { status: "SCHEDULED", startsAt: { gte: now } },
      orderBy: { startsAt: "asc" },
      select: { title: true, startsAt: true },
    }),
    discordApi<DiscordChannel[]>(`/guilds/${config.guildId}/channels`, config),
  ]);

  const category = channels.find((channel) => channel.type === 4 && channel.name.toLowerCase() === "rfl stream");
  if (!category) return { updated: false, reason: "missing_category" as const };
  const stream = channels.find((channel) => channel.type === 2 && channel.parent_id === category.id);
  if (!stream) return { updated: false, reason: "missing_channel" as const };

  const name = streamChannelName({ now, liveTitle: live?.title, upcoming: upcoming ?? undefined });
  if (stream.name === name) return { updated: false, name };
  await discordApi(`/channels/${stream.id}`, config, { method: "PATCH", body: { name } });
  return { updated: true, name };
}
