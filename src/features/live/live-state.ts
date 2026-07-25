import { prisma } from "@/lib/prisma";

export async function getLiveEventStateSignature(eventId: string) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      status: true,
      startsAt: true,
      fights: {
        orderBy: { position: "asc" },
        select: {
          id: true,
          status: true,
          result: true,
          resultSummary: true,
          market: {
            select: {
              status: true,
              redOddsBps: true,
              blueOddsBps: true,
            },
          },
        },
      },
    },
  });

  return JSON.stringify(event);
}
