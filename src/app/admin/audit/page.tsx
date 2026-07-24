import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Admin audit trail" };

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ actor?: string; action?: string; target?: string }> }) {
  const query = await searchParams;
  const entries = await prisma.adminAuditEntry.findMany({ where: { ...(query.actor ? { actorId: query.actor } : {}), ...(query.action ? { action: { contains: query.action, mode: "insensitive" } } : {}), ...(query.target ? { OR: [{ targetId: query.target }, { targetType: { contains: query.target, mode: "insensitive" } }] } : {}) }, include: { actor: { select: { displayName: true, email: true } } }, orderBy: { createdAt: "desc" }, take: 200 });
  return <main className="admin-page"><div className="admin-title"><div><p>Immutable operations history</p><h1>Audit trail</h1></div><span>Newest 200 matching entries</span></div><form className="audit-filters"><label>Action<input defaultValue={query.action ?? ""} name="action" placeholder="USER_STATUS" /></label><label>Target ID or type<input defaultValue={query.target ?? ""} name="target" /></label><button className="button button-ghost">Filter</button></form><section className="audit-list">{entries.map((entry) => <article className="admin-panel" key={entry.id}><header><time>{entry.createdAt.toLocaleString("en-US")}</time><strong>{entry.action.replaceAll("_", " ")}</strong><span>{entry.targetType} · {entry.targetId}</span></header><p>Actor: {entry.actor.displayName ?? entry.actor.email ?? entry.actorId}</p><pre>{JSON.stringify(entry.summary, null, 2)}</pre></article>)}</section></main>;
}
