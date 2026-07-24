import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { Countdown } from "@/features/live/countdown";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Live events" };
export const dynamic = "force-dynamic";

export default async function LiveHubPage() {
  const events = await prisma.event.findMany({ where: { status: { in: ["LIVE", "SCHEDULED"] } }, include: { fights: { include: { redFighter: true, blueFighter: true }, orderBy: { position: "asc" }, take: 1 } }, orderBy: [{ status: "asc" }, { startsAt: "asc" }] });
  const live = events.find(({ status }) => status === "LIVE");
  const upcoming = events.filter(({ status }) => status === "SCHEDULED");
  return <main className="live-hub"><SiteHeader /><section className="live-hub-hero"><p className="eyebrow"><span /> Fight night lives here</p><h1>{live ? "The realm is live." : "The next battle awaits."}</h1><p>Follow every matchup, official update, and result as it happens.</p>{live && <Link className="button button-primary" href={`/live/${live.id}`}><span className="live-pulse" /> Enter live event</Link>}</section>{upcoming.length > 0 && <section className="event-list"><div className="section-heading"><div><p className="eyebrow"><span /> Schedule</p><h2>Upcoming events</h2></div></div><div>{upcoming.map((event) => { const fight = event.fights[0]; return <Link className="event-list-card" href={`/live/${event.id}`} key={event.id}><div><small>{event.venue ?? "Realm Fighting League"}</small><h3>{event.title}</h3>{fight && <p>{fight.redFighter.name} <b>vs</b> {fight.blueFighter.name}</p>}</div><Countdown startsAt={event.startsAt.toISOString()} /><span>View event →</span></Link>; })}</div></section>}{!live && upcoming.length === 0 && <section className="live-empty"><h2>No event is scheduled.</h2><p>The official schedule will appear here as soon as the league publishes it.</p></section>}</main>;
}
