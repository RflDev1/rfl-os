import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { Countdown } from "@/features/live/countdown";
import { LiveTimeline } from "@/features/live/live-timeline";
import { prisma } from "@/lib/prisma";

export async function generateMetadata({ params }: { params: Promise<{ eventId: string }> }): Promise<Metadata> {
  const { eventId } = await params;
  const event = await prisma.event.findUnique({ where: { id: eventId }, select: { title: true } });
  return { title: event?.title ?? "Live event" };
}

export default async function LiveEventPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const event = await prisma.event.findFirst({ where: { id: eventId, status: { notIn: ["DRAFT", "CANCELLED"] } }, include: { fights: { include: { redFighter: true, blueFighter: true }, orderBy: { position: "asc" } }, updates: { orderBy: { createdAt: "asc" }, take: 100 } } });
  if (!event) notFound();
  const featured = event.fights.find(({ status }) => status === "LIVE") ?? event.fights.find(({ status }) => status === "SCHEDULED") ?? event.fights[0];
  return <main className="live-event-page"><SiteHeader /><section className="event-banner"><div><p className="eyebrow"><span className={event.status === "LIVE" ? "live-pulse" : ""} />{event.status === "LIVE" ? "Live now" : "Upcoming event"}</p><h1>{event.title}</h1><p>{event.subtitle ?? event.venue ?? "Realm Fighting League"}</p></div>{event.status === "SCHEDULED" && <Countdown startsAt={event.startsAt.toISOString()} />}</section>{featured ? <section className="featured-matchup"><div className="corner fighter-red"><span className="portrait-letter">{featured.redFighter.name[0]}</span><small>Red corner</small><Link href={`/fighters/${featured.redFighter.id}`}>{featured.redFighter.name}</Link><p>{featured.redFighter.nickname ? `“${featured.redFighter.nickname}”` : "RFL Fighter"}</p><strong>{featured.redFighter.wins}-{featured.redFighter.losses}-{featured.redFighter.draws}</strong></div><div className="fight-center"><span>{featured.status === "LIVE" ? "In progress" : featured.status === "COMPLETED" ? "Official result" : `Fight ${featured.position}`}</span><b>VS</b>{featured.resultSummary && <p>{featured.resultSummary}</p>}</div><div className="corner fighter-blue"><span className="portrait-letter">{featured.blueFighter.name[0]}</span><small>Blue corner</small><Link href={`/fighters/${featured.blueFighter.id}`}>{featured.blueFighter.name}</Link><p>{featured.blueFighter.nickname ? `“${featured.blueFighter.nickname}”` : "RFL Fighter"}</p><strong>{featured.blueFighter.wins}-{featured.blueFighter.losses}-{featured.blueFighter.draws}</strong></div></section> : <section className="event-no-fights"><p>Matchups have not been published for this event.</p></section>}<div className="live-event-grid"><section className="fight-card-list"><h2>Fight card</h2>{event.fights.map((fight) => <article className={fight.id === featured?.id ? "active" : ""} key={fight.id}><span>{fight.position}</span><p><Link href={`/fighters/${fight.redFighter.id}`}>{fight.redFighter.name}</Link><small>vs</small><Link href={`/fighters/${fight.blueFighter.id}`}>{fight.blueFighter.name}</Link></p><b>{fight.status === "COMPLETED" ? fight.result?.replace("_", " ") : fight.status}</b></article>)}</section><LiveTimeline eventId={event.id} initialItems={event.updates.map((item) => ({ id: item.id, kind: item.kind, message: item.message, createdAt: item.createdAt.toISOString() }))} /></div></main>;
}
