import { discordApi } from "./discord-api";

const CHANNEL = { TEXT: 0, VOICE: 2, CATEGORY: 4 } as const;
const PERMISSION = {
  VIEW_CHANNEL: 1n << 10n,
  SEND_MESSAGES: 1n << 11n,
  READ_MESSAGE_HISTORY: 1n << 16n,
  CONNECT: 1n << 20n,
};

type DiscordChannel = {
  id: string;
  guild_id?: string;
  parent_id?: string | null;
  name: string;
  topic?: string | null;
  type: number;
};

type DiscordGuild = { id: string; owner_id: string };
type DiscordRole = { id: string; name: string; managed: boolean };
type ApiConfig = { apiBaseUrl: string; botToken: string };
type TicketKind = "fighter" | "help" | "staff";

const layout = [
  {
    category: "RFL INFORMATION",
    channels: [
      ["rfl-site", "Official Realm Fighting League website and platform information."],
      ["rules", "Official Realm Fighting League server and competition rules."],
      ["how-ranking-works", "How RFL rankings, records, and eligible matchups work."],
    ],
  },
  {
    category: "RFL EVENTS",
    channels: [
      ["announcements", "Official RFL announcements."],
      ["upcoming-fights", "Upcoming official RFL fights and event schedules."],
    ],
  },
  {
    category: "RFL SUPPORT",
    channels: [
      ["become-a-fighter", "Apply to become an official RFL fighter.", "fighter"],
      ["help-ticket", "Open a private support ticket with RFL staff.", "help"],
      ["become-staff", "Apply to join the RFL staff team.", "staff"],
    ],
  },
  {
    category: "RFL COMMUNITY",
    channels: [
      ["general-chat", "The main RFL community chat."],
      ["rfl-sponsors", "Official RFL sponsors."],
      ["official-rfl-partners", "Official RFL partners."],
    ],
  },
] as const;

const voiceLayout = [
  { category: "RFL VOICE", channels: ["General VC", "WAITING ROOM", "OFFICIALS OFFICE", "STAFF"] },
  { category: "RFL STREAM", channels: ["Fight Stream"] },
] as const;

function readOnlyOverwrites(guildId: string) {
  return [{ id: guildId, type: 0, deny: PERMISSION.SEND_MESSAGES.toString() }];
}

function writableOverwrites(guildId: string) {
  return [{ id: guildId, type: 0, allow: PERMISSION.SEND_MESSAGES.toString() }];
}

async function createChannel(config: ApiConfig, guildId: string, body: Record<string, unknown>) {
  return discordApi<DiscordChannel>(`/guilds/${guildId}/channels`, config, { method: "POST", body });
}

function findChannel(channels: DiscordChannel[], name: string, type: number, parentId?: string) {
  return channels.find((channel) =>
    channel.type === type &&
    channel.name.toLowerCase() === name.toLowerCase() &&
    (parentId === undefined || channel.parent_id === parentId)
  );
}

async function ensureCategory(config: ApiConfig, guildId: string, channels: DiscordChannel[], name: string) {
  const existing = findChannel(channels, name, CHANNEL.CATEGORY);
  if (existing) return existing;
  const created = await createChannel(config, guildId, { name, type: CHANNEL.CATEGORY });
  channels.push(created);
  return created;
}

async function ensureTextChannel(
  config: ApiConfig,
  guildId: string,
  channels: DiscordChannel[],
  categoryId: string,
  name: string,
  topic: string,
  writable: boolean,
) {
  const existing = findChannel(channels, name, CHANNEL.TEXT, categoryId);
  const body = {
    name,
    type: CHANNEL.TEXT,
    parent_id: categoryId,
    topic,
    permission_overwrites: writable ? writableOverwrites(guildId) : readOnlyOverwrites(guildId),
  };
  if (existing) {
    return discordApi<DiscordChannel>(`/channels/${existing.id}`, config, { method: "PATCH", body });
  }
  const created = await createChannel(config, guildId, body);
  channels.push(created);
  return created;
}

async function ensureVoiceChannel(
  config: ApiConfig,
  guildId: string,
  channels: DiscordChannel[],
  categoryId: string,
  name: string,
) {
  const existing = findChannel(channels, name, CHANNEL.VOICE, categoryId);
  if (existing) return existing;
  const created = await createChannel(config, guildId, { name, type: CHANNEL.VOICE, parent_id: categoryId });
  channels.push(created);
  return created;
}

function ticketMessage(kind: TicketKind) {
  const content = {
    fighter: {
      title: "Become an RFL Fighter",
      description: "Open a private application ticket to begin the fighter onboarding process.",
      label: "Apply to become a fighter",
    },
    help: {
      title: "RFL Support",
      description: "Open a private ticket when you need help from the RFL team.",
      label: "Open a help ticket",
    },
    staff: {
      title: "Become RFL Staff",
      description: "Open a private application ticket to speak with the RFL staff team.",
      label: "Apply for staff",
    },
  }[kind];

  return {
    embeds: [{ title: content.title, description: content.description, color: 0x7c3aed }],
    components: [{
      type: 1,
      components: [{
        type: 2,
        style: 1,
        custom_id: `rfl-ticket:${kind}`,
        label: content.label,
        emoji: { name: "🎫" },
      }],
    }],
  };
}

async function ensureTicketPanel(config: ApiConfig, channelId: string, kind: TicketKind) {
  const messages = await discordApi<Array<{ id: string; author: { bot: boolean }; components?: Array<{ components?: Array<{ custom_id?: string }> }> }>>(
    `/channels/${channelId}/messages?limit=50`,
    config,
  );
  const customId = `rfl-ticket:${kind}`;
  const exists = messages.some((message) =>
    message.author.bot &&
    message.components?.some((row) => row.components?.some((component) => component.custom_id === customId))
  );
  if (!exists) {
    await discordApi(`/channels/${channelId}/messages`, config, { method: "POST", body: ticketMessage(kind) });
  }
}

export async function loadRflDiscordServer(config: ApiConfig & { guildId: string }) {
  const [guild, initialChannels] = await Promise.all([
    discordApi<DiscordGuild>(`/guilds/${config.guildId}`, config),
    discordApi<DiscordChannel[]>(`/guilds/${config.guildId}/channels`, config),
  ]);
  const channels = [...initialChannels];

  for (const section of layout) {
    const category = await ensureCategory(config, guild.id, channels, section.category);
    for (const definition of section.channels) {
      const [name, topic, ticketKind] = definition;
      const channel = await ensureTextChannel(
        config,
        guild.id,
        channels,
        category.id,
        name,
        topic,
        name === "general-chat",
      );
      if (ticketKind) await ensureTicketPanel(config, channel.id, ticketKind);
    }
  }

  for (const section of voiceLayout) {
    const category = await ensureCategory(config, guild.id, channels, section.category);
    for (const name of section.channels) {
      await ensureVoiceChannel(config, guild.id, channels, category.id, name);
    }
  }

  return { ownerId: guild.owner_id };
}

export async function createRflTicket(
  config: ApiConfig & { guildId: string },
  input: { userId: string; username: string; kind: TicketKind },
) {
  const channels = await discordApi<DiscordChannel[]>(`/guilds/${config.guildId}/channels`, config);
  const support = findChannel(channels, "RFL SUPPORT", CHANNEL.CATEGORY);
  if (!support) throw new Error("Run /loadrfl before opening tickets.");

  const ticketTopic = `RFL ${input.kind} ticket · owner:${input.userId}`;
  const existing = channels.find((channel) => channel.type === CHANNEL.TEXT && channel.topic === ticketTopic);
  if (existing) return existing;

  const safeName = input.username.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").slice(0, 35) || "player";
  const staffRoleIds = await findRflStaffRoleIds(config);
  const channel = await createChannel(config, config.guildId, {
    name: `${input.kind}-${safeName}`.slice(0, 100),
    type: CHANNEL.TEXT,
    parent_id: support.id,
    topic: ticketTopic,
    permission_overwrites: [
      { id: config.guildId, type: 0, deny: PERMISSION.VIEW_CHANNEL.toString() },
      {
        id: input.userId,
        type: 1,
        allow: (PERMISSION.VIEW_CHANNEL | PERMISSION.SEND_MESSAGES | PERMISSION.READ_MESSAGE_HISTORY).toString(),
      },
      ...staffRoleIds.map((id) => ({
        id,
        type: 0,
        allow: (PERMISSION.VIEW_CHANNEL | PERMISSION.SEND_MESSAGES | PERMISSION.READ_MESSAGE_HISTORY).toString(),
      })),
    ],
  });

  await discordApi(`/channels/${channel.id}/messages`, config, {
    method: "POST",
    body: {
      content: `<@${input.userId}> Your private ${input.kind} ticket is ready. An RFL staff member will respond here.`,
      allowed_mentions: { users: [input.userId] },
    },
  });
  return channel;
}

export async function assertGuildOwner(config: ApiConfig & { guildId: string }, userId: string) {
  const guild = await discordApi<DiscordGuild>(`/guilds/${config.guildId}`, config);
  if (guild.owner_id !== userId) throw new Error("Only the Discord server owner can use /loadrfl.");
}

export async function findRflStaffRoleIds(config: ApiConfig & { guildId: string }) {
  const roles = await discordApi<DiscordRole[]>(`/guilds/${config.guildId}/roles`, config);
  return roles.filter((role) => !role.managed && /owner|admin|staff|official/i.test(role.name)).map((role) => role.id);
}
