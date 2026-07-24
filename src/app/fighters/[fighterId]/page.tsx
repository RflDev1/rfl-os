import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { prisma } from "@/lib/prisma";

export async function generateMetadata({ params }: { params: Promise<{ fighterId: string }> }): Promise<Metadata> {
  const { fighterId } = await params;
  const fighter = await prisma.fighter.findUnique({ where: { id: fighterId }, select: { name: true } });
  return { title: fighter?.name ?? "Fighter" };
}

export default async function FighterPage({ params }: { params: Promise<{ fighterId: string }> }) {
  const { fighterId } = await params;
  const fighter = await prisma.fighter.findUnique({ where: { id: fighterId } });
  if (!fighter) notFound();
  const fights = await prisma.fight.findMany({ where: { OR: [{ redFighterId: fighter.id }, { blueFighterId: fighter.id }] }, include: { event: true, redFighter: true, blueFighter: true }, orderBy: { event: { startsAt: "desc" } }, take: 8 });
  const next = fights.find(({ status }) => status === "SCHEDULED");
  const decided = fighter.wins + fighter.losses + fighter.draws;
  const winRate = decided ? Math.round(fighter.wins / decided * 100) : 0;
  return <main className="fighter-page"><SiteHeader /><section className="fighter-profile-hero"><div className="fighter-profile-letter">{fighter.name[0]}</div><div><p className="eyebrow"><span /> RFL Fighter</p><div className={`fighter-status fighter-status-${fighter.status.toLowerCase()}`}>{fighter.status}</div><h1>{fighter.name}</h1><p>{fighter.nickname ? `“${fighter.nickname}”` : "Realm Fighting League"}</p><div className="record-block"><span><strong>{fighter.wins}</strong>Wins</span><span><strong>{fighter.losses}</strong>Losses</span><span><strong>{fighter.draws}</strong>Draws</span><span><strong>{fighter.rank ? `#${fighter.rank}` : "–"}</strong>Rank</span><span><strong>{winRate}%</strong>Win rate</span></div></div></section>{fighter.status !== "ACTIVE" && <aside className={`fighter-availability fighter-availability-${fighter.status.toLowerCase()}`}><strong>{fighter.status === "SUSPENDED" ? "This fighter is currently suspended." : "This fighter is currently inactive."}</strong><span>They remain in the official RFL record but cannot accept new fight requests.</span></aside>}{next && <Link className="next-fight-banner" href={`/live/${next.event.id}`}><span>Next fight</span><strong>{next.redFighterId === fighter.id ? next.blueFighter.name : next.redFighter.name}</strong><small>{next.event.title} →</small></Link>}<section className="fighter-history"><h2>Fight history</h2>{fights.length === 0 ? <p>No official fights recorded yet.</p> : fights.map((fight) => <Link href={`/live/${fight.eventId}`} key={fight.id}><time>{fight.event.startsAt.toLocaleDateString("en-US", { timeZone: "UTC" })}</time><span>{fight.redFighter.name} <b>vs</b> {fight.blueFighter.name}</span><strong>{fight.status === "COMPLETED" ? fight.result?.replace("_", " ") : fight.status}</strong></Link>)}</section></main>;
}
