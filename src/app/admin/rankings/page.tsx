import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { updateFighterStatusAction } from "@/features/fight-requests/fight-requests.actions";

export const metadata: Metadata = { title: "Fighter rankings" };

export default async function RankingsPage({ searchParams }: { searchParams: Promise<{ notice?: string; error?: string }> }) {
  const query = await searchParams;
  const fighters = await prisma.fighter.findMany({ include: { user: { select: { displayName: true } }, sentRequests: { where: { status: "PENDING" }, select: { id: true } }, receivedRequests: { where: { status: "PENDING" }, select: { id: true } } }, orderBy: [{ rank: "asc" }, { wins: "desc" }, { name: "asc" }] });
  return <main className="admin-page"><div className="admin-title"><div><p>Competition operations</p><h1>Fighter rankings</h1></div><Link className="button button-ghost" href="/admin/requests">Assign accounts and ranks</Link></div>{query.notice && <p className="admin-notice">{query.notice}</p>}{query.error && <p className="admin-error">{query.error}</p>}<section className="admin-panel ranking-table"><header><span>Rank</span><span>Fighter</span><span>Record</span><span>Linked account</span><span>Pending</span><span>Status</span></header>{fighters.map((fighter) => <div key={fighter.id}><strong>#{fighter.rank ?? "–"}</strong><span>{fighter.name}<small>{fighter.nickname}</small></span><b>{fighter.wins}-{fighter.losses}-{fighter.draws}</b><span>{fighter.user?.displayName ?? "Not linked"}</span><span>{fighter.sentRequests.length + fighter.receivedRequests.length}</span>{fighter.userId ? <form action={updateFighterStatusAction}><input name="fighterId" type="hidden" value={fighter.id} /><select aria-label={`${fighter.name} status`} defaultValue={fighter.status} name="status"><option value="ACTIVE">Active</option><option value="SUSPENDED">Suspended</option><option value="INACTIVE">Inactive</option></select><button className="button button-small">Save</button></form> : <span className="admin-guidance">Archived</span>}</div>)}</section></main>;
}
