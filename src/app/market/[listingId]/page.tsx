import { randomUUID } from "node:crypto";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { CollectibleCard } from "@/features/cards/collectible-card";
import { BuyPanel } from "@/features/marketplace/buy-panel";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Marketplace listing" };

export default async function ListingPage({ params, searchParams }: { params: Promise<{ listingId: string }>; searchParams: Promise<{ notice?: string }> }) {
  const [{ listingId }, { notice }, session] = await Promise.all([params, searchParams, auth()]);
  const listing = await prisma.marketListing.findUnique({ where: { id: listingId }, include: { card: { include: { definition: { include: { set: true } } } }, seller: { select: { displayName: true } }, sale: true } });
  if (!listing) notFound();
  const wallet = session?.user.id ? await prisma.wallet.findUnique({ where: { userId: session.user.id } }) : null;
  const ownedByViewer = session?.user.id === listing.sellerId;
  return <main className="listing-page"><SiteHeader /><Link className="back-link" href="/market">← Back to market</Link>{notice && <p className="market-notice">{notice}</p>}<section className="listing-layout"><CollectibleCard card={{ name: listing.card.definition.name, subtitle: listing.card.definition.subtitle, rarity: listing.card.definition.rarity, serialNumber: listing.card.serialNumber, setCode: listing.card.definition.set.code, cardNumber: listing.card.definition.cardNumber, imageUrl: listing.card.definition.imageUrl }} /><div><p className="eyebrow"><span /> {listing.card.definition.rarity}</p><h1>{listing.card.definition.name}</h1><p>Serial #{String(listing.card.serialNumber).padStart(6, "0")} · {listing.card.definition.set.name}</p><div className="seller-line"><small>Seller</small><strong>{listing.seller.displayName ?? "RFL Collector"}</strong></div>{listing.status !== "ACTIVE" ? <div className="listing-closed"><strong>{listing.status}</strong><p>This listing is no longer available.</p></div> : ownedByViewer ? <div className="listing-closed"><strong>Your listing</strong><Link className="button button-ghost" href="/market/mine">Manage listing</Link></div> : session?.user.profileCompletedAt ? <BuyPanel balance={wallet?.balance ?? 0} listingId={listing.id} price={listing.price} purchaseKey={randomUUID()} /> : <Link className="button button-primary" href="/signin">Sign in to purchase</Link>}</div></section></main>;
}
