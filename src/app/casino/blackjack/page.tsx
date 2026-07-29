import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { Crown } from "@/components/crown";
import { auth } from "@/lib/auth";
import { getEnv } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { BlackjackTable } from "@/features/blackjack/blackjack-table";
import { publicRound } from "@/features/blackjack/blackjack.service";
import { blackjackReturnLabel } from "@/features/blackjack/blackjack.logic";

export const metadata: Metadata = { title: "Blackjack" };

export default async function BlackjackPage() {
  const session = await auth();
  if (!session) redirect("/signin");
  if (session.user.status !== "ACTIVE") redirect("/signin?error=AccessDenied");
  if (!session.user.profileCompletedAt) redirect("/welcome");
  if (!session.user.legalOnboardingComplete) redirect("/welcome");
  if (!session.user.wageringEligible) redirect("/play");
  const env = getEnv();
  const [wallet, activeRound, recentRounds] = await Promise.all([
    prisma.wallet.findUnique({ where: { userId: session.user.id } }),
    prisma.blackjackRound.findFirst({ where: { userId: session.user.id, status: "ACTIVE" } }),
    prisma.blackjackRound.findMany({ where: { userId: session.user.id, status: "SETTLED" }, orderBy: { settledAt: "desc" }, take: 6 }),
  ]);
  const initialState = activeRound ? publicRound(activeRound) : {};

  return (
    <main className="casino-page">
      <SiteHeader />
      <div className="casino-shell">
        <div className="casino-subnav"><Link href="/casino/coin-flip">Coin Flip</Link><Link className="active" href="/casino/blackjack">Blackjack</Link><Link href="/casino/high-low">High-Low</Link></div>
        <div className="casino-heading"><div><p className="eyebrow"><span /> Realm Casino</p><h2>Blackjack</h2></div><p>Beat the dealer. Get as close to 21 as you dare.</p></div>
        <BlackjackTable initialBalance={wallet?.balance ?? 0} initialState={initialState} minWager={env.BLACKJACK_MIN_WAGER} maxWager={env.BLACKJACK_MAX_WAGER} naturalReturnLabel={blackjackReturnLabel(env.BLACKJACK_NATURAL_PAYOUT_BPS)} />

        <section className="game-rules blackjack-rules" aria-labelledby="blackjack-rules-title">
          <div><p className="eyebrow"><span /> Table rules</p><h2 id="blackjack-rules-title">Know the game</h2></div>
          <ol><li><span>01</span><p><strong>Reach 21, don’t go over</strong>Number cards use face value. Face cards are 10. Aces are 1 or 11.</p></li><li><span>02</span><p><strong>Dealer stands on soft 17</strong>The dealer draws to 16 and stands on every 17.</p></li><li><span>03</span><p><strong>Natural returns {blackjackReturnLabel(env.BLACKJACK_NATURAL_PAYOUT_BPS)}</strong>A normal win returns {blackjackReturnLabel(env.BLACKJACK_PAYOUT_BPS)}. A push returns your wager. Double is opening-hand only.</p></li></ol>
        </section>

        {recentRounds.length > 0 && <section className="blackjack-history" aria-labelledby="blackjack-history-title"><h2 id="blackjack-history-title">Recent hands</h2><div>{recentRounds.map((round) => <article key={round.id}><span>{round.outcome?.replaceAll("_", " ")}</span><strong className={round.payout > round.totalWager ? "win-text" : round.payout === round.totalWager ? "push-text" : "loss-text"}>{round.payout - round.totalWager > 0 ? "+" : ""}{(round.payout - round.totalWager).toLocaleString()} <Crown /></strong></article>)}</div></section>}
      </div>
    </main>
  );
}
