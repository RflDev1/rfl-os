import { cache } from "react";
import { prisma } from "@/lib/prisma";

export const getHomeContent = cache(async () => {
  const now = new Date();
  const [announcement, liveEvent, nextEvent, upcomingFights] = await Promise.all([
    prisma.announcement.findFirst({
      where: {
        active: true,
        startsAt: { lte: now },
        OR: [{ endsAt: null }, { endsAt: { gt: now } }],
      },
      orderBy: { startsAt: "desc" },
    }),
    prisma.event.findFirst({
      where: { status: "LIVE" },
      include: { fights: { include: { redFighter: true, blueFighter: true }, orderBy: { position: "asc" }, take: 1 } },
      orderBy: { startsAt: "asc" },
    }),
    prisma.event.findFirst({
      where: { status: "SCHEDULED", startsAt: { gt: now } },
      include: { fights: { include: { redFighter: true, blueFighter: true }, orderBy: { position: "asc" }, take: 1 } },
      orderBy: [{ featured: "desc" }, { startsAt: "asc" }],
    }),
    prisma.fight.findMany({
      where: { status: "SCHEDULED", event: { status: "SCHEDULED", startsAt: { gt: now } } },
      include: { event: true, redFighter: true, blueFighter: true },
      orderBy: [{ event: { startsAt: "asc" } }, { position: "asc" }],
      take: 4,
    }),
  ]);

  return { announcement, featuredEvent: liveEvent ?? nextEvent, upcomingFights };
});

