import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { Crown } from "@/components/crown";
import { CollectibleCard } from "@/features/cards/collectible-card";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Trading cards" };
export const dynamic = "force-dynamic";

export default async function CardsPage() {
  const session = await auth();
  const [sets, packs, owned] = await Promise.all([
    prisma.cardSet.findMany({ where: { active: true, releasedAt: { lte: new Date() } }, include: { definitions: { where: { active: true }, select: { id: true } } }, orderBy: { releasedAt: "desc" } }),
    prisma.packDefinition.findMany({ where: { active: true, set: { active: true, releasedAt: { lte: new Date() } } }, include: { set: true }, orderBy: { createdAt: "desc" } }),
    session?.user.id ? prisma.cardInstance.findMany({ where: { ownerId: session.user.id }, include: { definition: { include: { set: true } } }, orderBy: { acquiredAt: "desc" }, take: 100 }) : Promise.resolve([]),
  ]);
  return <main className="cards-page"><SiteHeader /><section className="cards-hero"><p className="eyebrow"><span /> RFL collectibles</p><h1>Own the realm.</h1><p>Open official packs, build your fighter collection, and discover every rarity.</p></section><section className="pack-shelf"><div className="section-heading"><div><p className="eyebrow"><span /> Available now</p><h2>Card packs</h2></div><p>Drop rates are published before every purchase.</p></div><div>{packs.map((pack) => <Link href={`/packs/${pack.id}`} key={pack.id}><span>{pack.set.code}</span><h3>{pack.name}</h3><p>{pack.cardsPerPack} cards · Table v{pack.dropTableVersion}</p><strong>{pack.price.toLocaleString()} <Crown /></strong></Link>)}</div>{packs.length === 0 && <p>No packs are currently available.</p>}</section><section className="collection-section"><div className="section-heading"><div><p className="eyebrow"><span /> Your vault</p><h2>{session ? `${owned.length} owned cards` : "Start your collection"}</h2></div><p>{sets.map((set) => `${set.code} ${set.definitions.length} cards`).join(" · ")}</p></div>{owned.length > 0 ? <div className="collection-grid">{owned.map((instance) => <CollectibleCard card={{ id: instance.id, name: instance.definition.name, subtitle: instance.definition.subtitle, rarity: instance.definition.rarity, serialNumber: instance.serialNumber, setCode: instance.definition.set.code, cardNumber: instance.definition.cardNumber, imageUrl: instance.definition.imageUrl }} key={instance.id} />)}</div> : <div className="collection-empty"><h3>{session ? "Your vault is empty." : "Sign in to build your vault."}</h3><p>Choose an available pack to reveal your first official RFL cards.</p></div>}</section></main>;
}
