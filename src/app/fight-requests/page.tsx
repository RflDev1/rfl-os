import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { requestFightAction } from "@/features/fight-requests/fight-requests.actions";
import { ranksEligible } from "@/features/fight-requests/fight-requests.logic";
import { auth } from "@/lib/auth";
import { getEnv } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { RequestFightButton } from "@/features/fight-requests/request-fight-button";

export const metadata: Metadata = { title: "Fight requests" };

export default async function FightRequestsPage({ searchParams }: { searchParams: Promise<{ notice?: string; error?: string; q?: string }> }) {
  const session = await auth();
  if (!session?.user.id || !session.user.profileCompletedAt) redirect("/signin");
  const fighter = await prisma.fighter.findUnique({ where: { userId: session.user.id } });
  if (!fighter) redirect("/play");
  const query = await searchParams;
  const rankRange = getEnv().FIGHT_REQUEST_RANK_RANGE;
  const [opponents, requests] = await Promise.all([
    fighter.rank ? prisma.fighter.findMany({
      where: {
        id: { not: fighter.id }, status: "ACTIVE", rank: { not: null }, userId: { not: null },
        ...(query.q ? { OR: [{ name: { contains: query.q, mode: "insensitive" } }, { nickname: { contains: query.q, mode: "insensitive" } }] } : {}),
      },
      orderBy: { rank: "asc" },
    }) : [],
    prisma.fightRequest.findMany({
      where: { OR: [{ requesterFighterId: fighter.id }, { opponentFighterId: fighter.id }] },
      include: { requester: true, opponent: true, fight: { include: { event: true } } },
      orderBy: { createdAt: "desc" }, take: 50,
    }),
  ]);
  const eligible = opponents.filter((opponent) => opponent.rank && fighter.rank && ranksEligible(fighter.rank, opponent.rank, rankRange));
  const pendingOpponentIds = new Set(requests.filter((request) => request.status === "PENDING").flatMap((request) => [request.requesterFighterId, request.opponentFighterId]));

  return <main className="fight-request-page"><SiteHeader /><section className="request-center-hero"><p className="eyebrow"><span /> Fighter access</p><h1>Fight requests</h1><p>Challenge a ranked fighter within {rankRange} positions of your official rank. Every matchup requires admin approval.</p><div><strong>#{fighter.rank ?? "–"}</strong><span>{fighter.name}</span><small>{fighter.wins}-{fighter.losses}-{fighter.draws}</small></div></section>{query.notice && <p className="request-page-notice" role="status"><span className="request-check" aria-hidden="true">✓</span>{query.notice}</p>}{query.error && <p className="request-page-error" role="alert">{query.error}</p>}<section className="request-opponents"><div className="section-heading"><div><p className="eyebrow"><span /> Eligible opponents</p><h2>Choose your matchup</h2></div><form><label className="sr-only" htmlFor="fighter-search">Search eligible fighters</label><input defaultValue={query.q ?? ""} id="fighter-search" name="q" placeholder="Search fighter name" type="search" /><button className="button button-ghost" type="submit">Search</button></form></div>{!fighter.rank ? <div className="request-empty"><h3>You need an official rank.</h3><p>An admin must assign your fighter rank before requests become available.</p></div> : eligible.length ? <div className="opponent-grid">{eligible.map((opponent) => { const pending = pendingOpponentIds.has(opponent.id); return <article key={opponent.id}><span aria-hidden="true" className="fighter-initial red-corner">{opponent.name[0]}</span><div><small>Rank #{opponent.rank}</small><h3>{opponent.name}</h3><p>{opponent.nickname ? `“${opponent.nickname}”` : "RFL Fighter"}</p><strong>{opponent.wins}-{opponent.losses}-{opponent.draws}</strong></div><form action={requestFightAction}><input name="opponentFighterId" type="hidden" value={opponent.id} /><input name="returnTo" type="hidden" value="fight-requests" /><RequestFightButton sent={pending} /></form><Link href={`/fighters/${opponent.id}`}>View profile →</Link></article>; })}</div> : <div className="request-empty"><h3>No eligible fighters found.</h3><p>Try another search or check again after rankings change.</p></div>}</section><section className="request-history"><div className="section-heading"><div><p className="eyebrow"><span /> Your activity</p><h2>Request status</h2></div></div>{requests.length ? requests.map((request) => { const other = request.requesterFighterId === fighter.id ? request.opponent : request.requester; return <article key={request.id}><div><strong>{other.name}</strong><small>{request.requesterFighterId === fighter.id ? "Sent" : "Received"} · {request.createdAt.toLocaleDateString("en-US")}</small></div><b className={`request-${request.status.toLowerCase()}`}>{request.status}</b>{request.fight ? <Link href={`/live/${request.fight.eventId}`}>{request.fight.event.title} · {request.fight.event.startsAt.toLocaleString("en-US")} →</Link> : <span>{request.status === "PENDING" ? "Awaiting admin review" : "No fight scheduled"}</span>}</article>; }) : <p>No requests yet.</p>}</section></main>;
}
