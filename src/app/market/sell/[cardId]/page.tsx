import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { CollectibleCard } from "@/features/cards/collectible-card";
import { Crown } from "@/components/crown";
import { createListingAction } from "@/features/marketplace/marketplace.actions";
import { auth } from "@/lib/auth";
import { getEnv } from "@/lib/env";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "List a card" };

export default async function SellCardPage({ params, searchParams }: { params: Promise<{ cardId: string }>; searchParams: Promise<{ error?: string }> }) {
  const [session, { cardId }, query] = await Promise.all([auth(), params, searchParams]);
  if (!session?.user.id) redirect("/signin");
  const card = await prisma.cardInstance.findFirst({ where: { id: cardId, ownerId: session.user.id, listings: { none: { status: "ACTIVE" } } }, include: { definition: { include: { set: true } } } });
  if (!card) notFound();
  const env = getEnv();
  return <main className="sell-page"><SiteHeader /><Link className="back-link" href="/market/mine">← Back to your cards</Link><section className="sell-layout"><CollectibleCard card={{ name: card.definition.name, subtitle: card.definition.subtitle, rarity: card.definition.rarity, serialNumber: card.serialNumber, setCode: card.definition.set.code, cardNumber: card.definition.cardNumber, imageUrl: card.definition.imageUrl }} /><form action={createListingAction}><p className="eyebrow"><span /> Review listing</p><h1>Set your price.</h1><p>{card.definition.name} · Serial #{String(card.serialNumber).padStart(6, "0")}</p><input name="cardInstanceId" type="hidden" value={card.id} /><label>Sale price<span><Crown /><input defaultValue={env.MARKET_MIN_PRICE} min={env.MARKET_MIN_PRICE} max={env.MARKET_MAX_PRICE} name="price" step="1" type="number" /></span></label><dl><div><dt>Marketplace fee</dt><dd>0 Crowns</dd></div><div><dt>You receive</dt><dd>Full listed price</dd></div></dl>{query.error && <p className="game-error" role="alert">{query.error}</p>}<button className="button button-primary" type="submit">Publish listing</button><small>Listings remain active until sold or cancelled.</small></form></section></main>;
}
