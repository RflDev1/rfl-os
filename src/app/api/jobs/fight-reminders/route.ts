import { NextResponse } from "next/server";
import { deliverDueDiscordNotifications } from "@/features/fight-requests/discord.service";
import { getEnv } from "@/lib/env";
import { syncFightStreamChannel } from "@/features/discord/stream-channel";

export async function POST(request: Request) {
  const env = getEnv();
  if (!env.REMINDER_JOB_SECRET) {
    return NextResponse.json({ error: "Reminder processing is not configured." }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${env.REMINDER_JOB_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const result = await deliverDueDiscordNotifications({
    apiBaseUrl: env.DISCORD_API_BASE_URL,
    botToken: env.DISCORD_BOT_TOKEN,
    appUrl: env.APP_URL,
  });
  const stream = await syncFightStreamChannel({
    apiBaseUrl: env.DISCORD_API_BASE_URL,
    botToken: env.DISCORD_BOT_TOKEN,
    guildId: env.DISCORD_GUILD_ID,
  }).catch((error) => ({ updated: false, error: error instanceof Error ? error.message : "Stream sync failed." }));
  return NextResponse.json({ ...result, stream });
}
