import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { auth } from "@/lib/auth";
import { getEnv } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { HighLowGame } from "@/features/high-low/high-low-game";
import { publicHighLow } from "@/features/high-low/high-low.service";

export const metadata: Metadata = { title: "High-Low" };

export default async function HighLowPage() {
  const session = await auth();
  if (!session) redirect("/signin");
  if (session.user.status !== "ACTIVE") redirect("/signin?error=AccessDenied");
  if (!session.user.profileCompletedAt) redirect("/welcome");
  const env = getEnv();
  const [wallet, active] = await Promise.all([
    prisma.wallet.findUnique({ where: { userId: session.user.id } }),
    prisma.highLowRound.findFirst({ where: { userId: session.user.id, status: "ACTIVE" }, include: { guesses: { orderBy: { createdAt: "asc" } } } }),
  ]);
  return <main className="casino-page"><SiteHeader /><div className="casino-shell"><div className="casino-subnav"><Link href="/casino/coin-flip">Coin Flip</Link><Link href="/casino/blackjack">Blackjack</Link><Link className="active" href="/casino/high-low">High-Low</Link></div><div className="casino-heading"><div><p className="eyebrow"><span /> Realm Casino</p><h2>High-Low</h2></div><p>Read the card. Build the run. Know when to leave.</p></div><HighLowGame initialBalance={wallet?.balance ?? 0} initialState={active ? publicHighLow({ ...active, replayed: true }) : {}} minWager={env.HIGH_LOW_MIN_WAGER} maxWager={env.HIGH_LOW_MAX_WAGER} /><section className="game-rules"><div><p className="eyebrow"><span /> Run rules</p><h2>Push your luck</h2></div><ol><li><span>01</span><p><strong>Call higher or lower</strong>Ace is high. Suits do not affect rank.</p></li><li><span>02</span><p><strong>Ties lose the run</strong>An equal rank settles the round with no payout.</p></li><li><span>03</span><p><strong>Returns match the risk</strong>The exact next return appears on each choice. Cash out after one win or finish all {env.HIGH_LOW_MAX_STEPS} steps.</p></li></ol></section></div></main>;
}
