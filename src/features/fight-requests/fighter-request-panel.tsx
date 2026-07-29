import { auth } from "@/lib/auth";
import { getEnv } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { ranksEligible } from "./fight-requests.logic";
import { requestFightAction } from "./fight-requests.actions";
import { RequestFightButton } from "./request-fight-button";

export async function FighterRequestPanel({ opponentFighterId, requestError, requestNotice }: { opponentFighterId: string; requestError?: string; requestNotice?: string }) {
  const session = await auth();
  if (!session?.user.id) return null;
  const [requester, opponent] = await Promise.all([prisma.fighter.findUnique({ where: { userId: session.user.id } }), prisma.fighter.findUnique({ where: { id: opponentFighterId } })]);
  if (!requester?.rank || !opponent?.rank || requester.status !== "ACTIVE" || opponent.status !== "ACTIVE" || !opponent.userId || requester.id === opponent.id) return null;
  const [eligible, pending] = await Promise.all([
    Promise.resolve(ranksEligible(requester.rank, opponent.rank, getEnv().FIGHT_REQUEST_RANK_RANGE)),
    prisma.fightRequest.findFirst({ where: { status: "PENDING", OR: [{ requesterFighterId: requester.id, opponentFighterId: opponent.id }, { requesterFighterId: opponent.id, opponentFighterId: requester.id }] }, select: { id: true } }),
  ]);
  return <section className="fighter-request-panel"><div><p className="eyebrow"><span /> Fighter challenge</p><h2>Request this matchup</h2><p>Your rank: #{requester.rank} · Opponent rank: #{opponent.rank}</p></div>{requestNotice && <p className="request-notice" role="status"><span className="request-check" aria-hidden="true">✓</span>{requestNotice}</p>}{requestError && <p className="game-error" role="alert">{requestError}</p>}{eligible ? <form action={requestFightAction}><input name="opponentFighterId" type="hidden" value={opponent.id} /><p>An admin will confirm rank eligibility and schedule the fight before either fighter is notified.</p><RequestFightButton sent={Boolean(pending)} /></form> : <p className="request-ineligible">This fighter is outside your permitted rank window.</p>}</section>;
}
