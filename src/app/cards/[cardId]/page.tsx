import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { CollectibleCard } from "@/features/cards/collectible-card";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Collection card" };

export default async function CardDetailPage({ params }: { params: Promise<{ cardId: string }> }) {
  const session = await auth();
  if (!session?.user.id) notFound();
  const { cardId } = await params;
  const card = await prisma.cardInstance.findFirst({ where: { id: cardId, ownerId: session.user.id }, include: { definition: { include: { set: true, fighter: true } }, opening: { include: { pack: true } } } });
  if (!card) notFound();
  return <main className="card-detail-page"><SiteHeader /><Link className="back-link" href="/cards">← Back to collection</Link><div className="card-detail-layout"><CollectibleCard card={{ name: card.definition.name, subtitle: card.definition.subtitle, rarity: card.definition.rarity, serialNumber: card.serialNumber, setCode: card.definition.set.code, cardNumber: card.definition.cardNumber, imageUrl: card.definition.imageUrl }} /><section><p className="eyebrow"><span /> {card.definition.rarity}</p><h1>{card.definition.name}</h1><p>{card.definition.subtitle ?? card.definition.set.description ?? "Official Realm Fighting League collectible."}</p><dl><div><dt>Serial</dt><dd>#{String(card.serialNumber).padStart(6, "0")}</dd></div><div><dt>Set</dt><dd>{card.definition.set.name}</dd></div><div><dt>Card</dt><dd>#{String(card.definition.cardNumber).padStart(3, "0")}</dd></div><div><dt>Acquired</dt><dd>{card.acquiredAt.toLocaleDateString("en-US")}</dd></div></dl>{card.definition.fighter && <Link className="button button-ghost" href={`/fighters/${card.definition.fighter.id}`}>View fighter profile</Link>}<small>Opened from {card.opening.pack.name} · Drop table v{card.opening.dropTableVersion}</small></section></div></main>;
}
