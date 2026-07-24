import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Fighters" };

export default async function FightersPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  const query = await searchParams;
  const status = ["ACTIVE", "SUSPENDED", "INACTIVE"].includes(query.status ?? "") ? query.status as "ACTIVE" | "SUSPENDED" | "INACTIVE" : undefined;
  const fighters = await prisma.fighter.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(query.q ? { OR: [{ name: { contains: query.q, mode: "insensitive" } }, { nickname: { contains: query.q, mode: "insensitive" } }] } : {}),
    },
    include: {
      redFights: { select: { id: true } },
      blueFights: { select: { id: true } },
    },
    orderBy: [{ status: "asc" }, { rank: "asc" }, { wins: "desc" }, { name: "asc" }],
  });

  return <main className="fighters-page"><SiteHeader /><section className="fighters-hero"><p className="eyebrow"><span /> Official roster</p><h1>Meet the fighters.</h1><p>Explore every RFL competitor, official record, current rank, and league status.</p></section><form className="fighter-directory-filters"><label>Search<input defaultValue={query.q ?? ""} name="q" placeholder="Fighter or nickname" type="search" /></label><label>Status<select defaultValue={status ?? ""} name="status"><option value="">All statuses</option><option value="ACTIVE">Active</option><option value="SUSPENDED">Suspended</option><option value="INACTIVE">Inactive</option></select></label><button className="button button-ghost">Apply filters</button></form><section className="fighter-directory"><div className="section-heading"><div><p className="eyebrow"><span /> League roster</p><h2>{fighters.length} fighters</h2></div></div>{fighters.length ? <div className="fighter-directory-grid">{fighters.map((fighter) => { const appearances = fighter.redFights.length + fighter.blueFights.length; return <Link href={`/fighters/${fighter.id}`} key={fighter.id}><div className="fighter-directory-portrait">{fighter.name[0]}</div><div><span className={`fighter-status fighter-status-${fighter.status.toLowerCase()}`}>{fighter.status}</span><small>{fighter.rank ? `Rank #${fighter.rank}` : "Unranked"}</small><h3>{fighter.name}</h3><p>{fighter.nickname ? `“${fighter.nickname}”` : "RFL Fighter"}</p><strong>{fighter.wins}-{fighter.losses}-{fighter.draws}</strong><small>{appearances} official appearance{appearances === 1 ? "" : "s"}</small></div></Link>; })}</div> : <div className="request-empty"><h3>No fighters found.</h3><p>Try another name or status.</p></div>}</section></main>;
}
