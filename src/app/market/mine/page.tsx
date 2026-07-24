import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { Crown } from "@/components/crown";
import { cancelListingAction } from "@/features/marketplace/marketplace.actions";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "My marketplace" };

export default async function MyMarketPage({ searchParams }: { searchParams: Promise<{ notice?: string; error?: string }> }) {
  const [session, query] = await Promise.all([auth(), searchParams]);
  if (!session?.user.id) redirect("/signin");
  const [cards, listings, purchases, sales] = await Promise.all([prisma.cardInstance.findMany({ where: { ownerId: session.user.id, listings: { none: { status: "ACTIVE" } } }, include: { definition: { include: { set: true } } }, orderBy: { acquiredAt: "desc" }, take: 100 }), prisma.marketListing.findMany({ where: { sellerId: session.user.id, status: "ACTIVE" }, include: { card: { include: { definition: true } } }, orderBy: { createdAt: "desc" } }), prisma.marketSale.findMany({ where: { buyerId: session.user.id }, include: { card: { include: { definition: true } } }, orderBy: { createdAt: "desc" }, take: 20 }), prisma.marketSale.findMany({ where: { sellerId: session.user.id }, include: { card: { include: { definition: true } } }, orderBy: { createdAt: "desc" }, take: 20 })]);
  return <main className="my-market-page"><SiteHeader /><section className="my-market-header"><div><p className="eyebrow"><span /> Your exchange</p><h1>Marketplace activity</h1></div><Link className="button button-ghost" href="/market">Browse market</Link></section>{query.notice && <p className="admin-notice">{query.notice}</p>}{query.error && <p className="admin-error">{query.error}</p>}<section className="my-listings"><h2>Active listings</h2>{listings.length ? listings.map((listing) => <article key={listing.id}><div><strong>{listing.card.definition.name}</strong><small>Serial #{String(listing.card.serialNumber).padStart(6, "0")}</small></div><b>{listing.price.toLocaleString()} <Crown /></b><form action={cancelListingAction}><input name="listingId" type="hidden" value={listing.id} /><button className="button button-ghost">Cancel listing</button></form></article>) : <p>You have no active listings.</p>}</section><section className="sellable-cards"><h2>List a card</h2><div>{cards.map((card) => <Link href={`/market/sell/${card.id}`} key={card.id}><span>{card.definition.rarity}</span><strong>{card.definition.name}</strong><small>{card.definition.set.code} · Serial #{String(card.serialNumber).padStart(6, "0")}</small></Link>)}</div>{cards.length === 0 && <p>No unlisted cards are available.</p>}</section><section className="trade-history"><div><h2>Purchases</h2>{purchases.map((sale) => <p key={sale.id}><span>{sale.card.definition.name}</span><strong>-{sale.price.toLocaleString()} Crowns</strong></p>)}</div><div><h2>Sales</h2>{sales.map((sale) => <p key={sale.id}><span>{sale.card.definition.name}</span><strong>+{(sale.price - sale.fee).toLocaleString()} Crowns</strong></p>)}</div></section></main>;
}
