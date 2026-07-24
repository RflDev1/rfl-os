import { prisma } from "@/lib/prisma";

export async function deliverDiscordNotification(notificationId: string, config: { apiBaseUrl: string; botToken: string; appUrl: string }, fetcher: typeof fetch = fetch) {
  const job = await prisma.discordNotification.findUnique({ where: { id: notificationId }, include: { request: { include: { requester: true, opponent: true, fight: { include: { event: true } } } } } });
  if (!job || job.status === "SENT") return job;
  if (!job.request.fight) throw new Error("Approved fight schedule is missing.");
  const opponent = job.recipientUserId === job.request.requester.userId ? job.request.opponent.name : job.request.requester.name;
  const message = `Your RFL fight request has been approved. You are scheduled against ${opponent} at ${job.request.fight.event.title} on ${job.request.fight.scheduledAt?.toISOString() ?? job.request.fight.event.startsAt.toISOString()}. View the event: ${config.appUrl}/live/${job.request.fight.eventId}`;
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
