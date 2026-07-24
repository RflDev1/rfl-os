import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function FightRequestStatus() {
  const session = await auth();
  if (!session?.user.id) return null;
  const fighter = await prisma.fighter.findUnique({ where: { userId: session.user.id } });
  if (!fighter) return null;
  const requests = await prisma.fightRequest.findMany({ where: { OR: [{ requesterFighterId: fighter.id }, { opponentFighterId: fighter.id }] }, include: { requester: true, opponent: true, fight: { include: { event: true } }, notifications: { where: { recipientUserId: session.user.id } } }, orderBy: { createdAt: "desc" }, take: 20 });
  return <section className="profile-requests"><div className="section-heading"><div><p className="eyebrow"><span /> Fighter profile</p><h2>Fight request status</h2></div><p>Rank #{fighter.rank ?? "Unranked"}</p></div>{requests.length ? requests.map((request) => { const other = request.requesterFighterId === fighter.id ? request.opponent : request.requester; return <article key={request.id}><div><strong>{other.name}</strong><small>Rank #{request.requesterFighterId === fighter.id ? request.opponentRank : request.requesterRank} · {request.createdAt.toLocaleDateString("en-US")}</small></div><b className={`request-${request.status.toLowerCase()}`}>{request.status}</b>{request.fight ? <Link href={`/live/${request.fight.eventId}`}>{request.fight.event.title} →</Link> : <span>{request.status === "PENDING" ? "Awaiting admin review" : "No fight scheduled"}</span>}<small>Discord: {request.notifications[0]?.status ?? (request.status === "APPROVED" ? "UNAVAILABLE" : "NOT READY")}</small></article>; }) : <p>No fight requests yet. Open an eligible fighter profile to request a matchup.</p>}</section>;
}
