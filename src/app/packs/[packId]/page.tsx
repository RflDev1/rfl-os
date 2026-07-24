import { randomUUID } from "node:crypto";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { Crown } from "@/components/crown";
import { PackReveal } from "@/features/cards/pack-reveal";
import { rarityRates } from "@/features/cards/cards.logic";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Open card pack" };

export default async function PackPage({ params }: { params: Promise<{ packId: string }> }) {
  const { packId } = await params;
  const [session, pack] = await Promise.all([auth(), prisma.packDefinition.findFirst({ where: { id: packId, active: true, set: { active: true, releasedAt: { lte: new Date() } } }, include: { set: true } })]);
  if (!pack) notFound();
  const wallet = session?.user.id ? await prisma.wallet.findUnique({ where: { userId: session.user.id } }) : null;
  const rates = rarityRates({ COMMON: pack.commonWeight, RARE: pack.rareWeight, EPIC: pack.epicWeight, LEGENDARY: pack.legendaryWeight });
  return <main className="pack-page"><SiteHeader /><section className="pack-hero"><div className="pack-art"><span>{pack.set.code}</span><strong>{pack.cardsPerPack}</strong><small>Official cards</small></div><div><p className="eyebrow"><span /> {pack.set.name}</p><h1>{pack.name}</h1><p>{pack.description ?? `Discover ${pack.cardsPerPack} cards from ${pack.set.name}.`}</p><strong className="pack-price">{pack.price.toLocaleString()} <Crown /></strong>{session?.user.profileCompletedAt ? <PackReveal balance={wallet?.balance ?? 0} openingKey={randomUUID()} packId={pack.id} price={pack.price} /> : <a className="button button-primary" href="/signin">Sign in to open</a>}</div></section><section className="drop-rates"><div><p className="eyebrow"><span /> Published odds</p><h2>Drop table v{pack.dropTableVersion}</h2><p>Each card slot is selected independently. Duplicates are possible.</p></div><dl>{(["COMMON", "RARE", "EPIC", "LEGENDARY"] as const).map((rarity) => <div key={rarity}><dt>{rarity}</dt><dd>{(rates[rarity] * 100).toFixed(2)}%</dd></div>)}</dl></section></main>;
}
