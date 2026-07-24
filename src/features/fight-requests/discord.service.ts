import { prisma } from "@/lib/prisma";

export async function deliverDiscordNotification(notificationId: string, config: { apiBaseUrl: string; botToken: string; appUrl: string }, fetcher: typeof fetch = fetch) {
  const job = await prisma.discordNotification.findUnique({
    where: { id: notificationId },
    include: { fight: { include: { event: true, redFighter: true, blueFighter: true } } },
  });
  if (!job || job.status === "SENT") return job;
  const recipientIsRed = job.recipientUserId === job.fight.redFighter.userId;
  const opponent = recipientIsRed ? job.fight.blueFighter.name : job.fight.redFighter.name;
  const scheduledAt = job.fight.scheduledAt ?? job.fight.event.startsAt;
  const lead = job.kind === "FIGHT_REMINDER_2H" ? "Your RFL fight starts in 2 hours."
    : job.kind === "FIGHT_REMINDER_1H" ? "Your RFL fight starts in 1 hour."
      : job.kind === "FIGHT_REMINDER_10M" ? "Your RFL fight starts in 10 minutes."
        : "Your RFL fight request has been approved.";
  const message = `${lead} You are scheduled against ${opponent} at ${job.fight.event.title} on ${scheduledAt.toISOString()}. View the event: ${config.appUrl}/live/${job.fight.eventId}`;
  try {
    const headers = { Authorization: `Bot ${config.botToken}`, "Content-Type": "application/json" };
    const dmResponse = await fetcher(`${config.apiBaseUrl.replace(/\/$/, "")}/users/@me/channels`, { method: "POST", headers, body: JSON.stringify({ recipient_id: job.discordUserId }) });
    if (!dmResponse.ok) throw new Error(`Discord DM channel failed (${dmResponse.status}).`);
    const channel = await dmResponse.json() as { id?: string };
    if (!channel.id) throw new Error("Discord DM channel response was invalid.");
    const messageResponse = await fetcher(`${config.apiBaseUrl.replace(/\/$/, "")}/channels/${channel.id}/messages`, { method: "POST", headers, body: JSON.stringify({ content: message }) });
    if (!messageResponse.ok) throw new Error(`Discord message failed (${messageResponse.status}).`);
    return prisma.discordNotification.update({ where: { id: job.id }, data: { status: "SENT", sentAt: new Date(), attempts: { increment: 1 }, lastError: null } });
  } catch (error) {
    await prisma.discordNotification.update({ where: { id: job.id }, data: { status: "FAILED", attempts: { increment: 1 }, lastError: error instanceof Error ? error.message.slice(0, 300) : "Discord delivery failed." } });
    throw error;
  }
}

export async function deliverDueDiscordNotifications(
  config: { apiBaseUrl: string; botToken: string; appUrl: string },
  now = new Date(),
) {
  const graceStart = new Date(now.getTime() - 15 * 60 * 1000);
  const jobs = await prisma.discordNotification.findMany({
    where: {
      status: { in: ["PENDING", "FAILED"] },
      scheduledFor: { lte: now, gte: graceStart },
      fight: { status: "SCHEDULED", OR: [{ scheduledAt: { gt: now } }, { scheduledAt: null, event: { startsAt: { gt: now } } }] },
    },
    orderBy: { scheduledFor: "asc" },
    take: 100,
  });
  const results = await Promise.allSettled(jobs.map((job) => deliverDiscordNotification(job.id, config)));
  return {
    processed: jobs.length,
    sent: results.filter((result) => result.status === "fulfilled").length,
    failed: results.filter((result) => result.status === "rejected").length,
  };
}
