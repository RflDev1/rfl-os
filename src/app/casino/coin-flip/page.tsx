import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { Crown } from "@/components/crown";
import { auth } from "@/lib/auth";
import { getEnv } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { CoinFlipGame } from "@/features/coin-flip/coin-flip-game";
import { payoutLabel } from "@/features/coin-flip/coin-flip.logic";

export const metadata: Metadata = { title: "Coin Flip" };

export default async function CoinFlipPage() {
  const session = await auth();
  if (!session) redirect("/signin");
  if (session.user.status !== "ACTIVE") redirect("/signin?error=AccessDenied");
  if (!session.user.profileCompletedAt) redirect("/welcome");
  const env = getEnv();
  const [wallet, rounds] = await Promise.all([
    prisma.wallet.findUnique({ where: { userId: session.user.id } }),
    prisma.coinFlipRound.findMany({ where: { userId: session.user.id }, orderBy: { createdAt: "desc" }, take: 8 }),
  ]);

  return (
    <main className="casino-page">
      <SiteHeader />
      <div className="casino-shell">
        <div className="casino-subnav"><Link className="active" href="/casino/coin-flip">Coin Flip</Link><Link href="/casino/blackjack">Blackjack</Link><Link href="/casino/high-low">High-Low</Link></div>
        <div className="casino-heading"><div><p className="eyebrow"><span /> Realm Casino</p><h2>Coin Flip</h2></div><p>Pick a side. Set your Crowns. Let fate speak.</p></div>
        <CoinFlipGame initialBalance={wallet?.balance ?? 0} minWager={env.COIN_FLIP_MIN_WAGER} maxWager={env.COIN_FLIP_MAX_WAGER} payoutBasisPoints={env.COIN_FLIP_PAYOUT_BPS} />

        <section className="game-rules" aria-labelledby="rules-title">
          <div><p className="eyebrow"><span /> Plain and simple</p><h2 id="rules-title">How it works</h2></div>
          <ol><li><span>01</span><p><strong>Choose heads or tails</strong>Your choice is locked when you press Flip.</p></li><li><span>02</span><p><strong>Wager Crowns</strong>Wagers are virtual only and have no cash value.</p></li><li><span>03</span><p><strong>Win {payoutLabel(env.COIN_FLIP_PAYOUT_BPS)} total</strong>A win returns the displayed total; a loss costs the wager.</p></li></ol>
        </section>

        {rounds.length > 0 && (
          <section className="round-history" aria-labelledby="rounds-title"><h2 id="rounds-title">Recent flips</h2><div>{rounds.map((round) => <article key={round.id}><span className={round.result === "HEADS" ? "mini-heads" : "mini-tails"}>{round.result[0]}</span><p><strong>{round.result}</strong><small>You called {round.choice.toLowerCase()}</small></p><b className={round.won ? "win-text" : "loss-text"}>{round.won ? `+${(round.payout - round.wager).toLocaleString()}` : `-${round.wager.toLocaleString()}`} <Crown /></b></article>)}</div></section>
        )}
      </div>
    </main>
  );
}
