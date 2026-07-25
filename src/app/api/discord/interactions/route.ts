import { createPublicKey, verify } from "node:crypto";
import { after } from "next/server";
import { getEnv } from "@/lib/env";
import { assertGuildOwner, createRflTicket, loadRflDiscordServer } from "@/features/discord/server-loader";
import { syncFightStreamChannel } from "@/features/discord/stream-channel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DiscordInteraction = {
  application_id: string;
  token: string;
  type: number;
  guild_id?: string;
  data?: { name?: string; custom_id?: string };
  member?: { user?: { id: string; username: string } };
  user?: { id: string; username: string };
};

const EPHEMERAL = 1 << 6;

function response(content: string, status = 200) {
  return Response.json({ type: 4, data: { content, flags: EPHEMERAL } }, { status });
}

function verifyDiscordSignature(body: string, timestamp: string | null, signature: string | null, publicKey: string) {
  if (!timestamp || !signature || !/^[a-fA-F0-9]{128}$/.test(signature)) return false;
  const key = createPublicKey({
    key: Buffer.concat([
      Buffer.from("302a300506032b6570032100", "hex"),
      Buffer.from(publicKey, "hex"),
    ]),
    format: "der",
    type: "spki",
  });
  return verify(
    null,
    Buffer.from(timestamp + body),
    key,
    Buffer.from(signature, "hex"),
  );
}

async function editDeferredResponse(interaction: DiscordInteraction, content: string) {
  const env = getEnv();
  const result = await fetch(
    `${env.DISCORD_API_BASE_URL.replace(/\/$/, "")}/webhooks/${interaction.application_id}/${interaction.token}/messages/@original`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, components: [] }),
      cache: "no-store",
    },
  );
  if (!result.ok) throw new Error(`Discord interaction response failed: ${result.status}`);
}

export async function POST(request: Request) {
  const env = getEnv();
  if (!env.DISCORD_PUBLIC_KEY) return new Response("Discord interactions are not configured.", { status: 503 });

  const body = await request.text();
  if (!verifyDiscordSignature(
    body,
    request.headers.get("x-signature-timestamp"),
    request.headers.get("x-signature-ed25519"),
    env.DISCORD_PUBLIC_KEY,
  )) {
    return new Response("Invalid request signature.", { status: 401 });
  }

  const interaction = JSON.parse(body) as DiscordInteraction;
  if (interaction.type === 1) return Response.json({ type: 1 });

  const guildId = interaction.guild_id;
  const user = interaction.member?.user ?? interaction.user;
  if (!guildId || guildId !== env.DISCORD_GUILD_ID || !user) {
    return response("This RFL command can only be used inside the official RFL Discord server.");
  }

  const config = {
    apiBaseUrl: env.DISCORD_API_BASE_URL,
    botToken: env.DISCORD_BOT_TOKEN,
    guildId,
  };

  if (interaction.type === 2 && interaction.data?.name === "loadrfl") {
    try {
      await assertGuildOwner(config, user.id);
    } catch {
      return response("Only the Discord server owner can use `/loadrfl`.");
    }

    after(async () => {
      try {
        await loadRflDiscordServer(config);
        await syncFightStreamChannel(config);
        await editDeferredResponse(interaction, "✅ The RFL Discord server layout has been built and synchronized.");
      } catch (error) {
        console.error("[rfl-discord] Server load failed", error);
        await editDeferredResponse(interaction, "❌ The server could not be loaded. Check the bot permissions and application logs.").catch(() => undefined);
      }
    });
    return Response.json({ type: 5, data: { flags: EPHEMERAL } });
  }

  if (interaction.type === 3 && interaction.data?.custom_id?.startsWith("rfl-ticket:")) {
    const kind = interaction.data.custom_id.slice("rfl-ticket:".length);
    if (kind !== "fighter" && kind !== "help" && kind !== "staff") return response("Unknown ticket type.");

    after(async () => {
      try {
        const channel = await createRflTicket(config, { userId: user.id, username: user.username, kind });
        await editDeferredResponse(interaction, `✅ Your private ticket is ready: <#${channel.id}>`);
      } catch (error) {
        console.error("[rfl-discord] Ticket creation failed", error);
        await editDeferredResponse(interaction, "❌ Your ticket could not be created. Please contact an RFL administrator.").catch(() => undefined);
      }
    });
    return Response.json({ type: 5, data: { flags: EPHEMERAL } });
  }

  return response("This interaction is not supported.");
}
