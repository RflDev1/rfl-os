import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { SiteHeader } from "@/components/site-header";
import { Crown } from "@/components/crown";
import { DailyReward } from "@/features/wallet/daily-reward";
import { getWalletSummary } from "@/features/wallet/wallet.service";
import { getEnv } from "@/lib/env";
import Link from "next/link";

export const metadata: Metadata = { title: "Your corner" };

const activityLabels = {
  DAILY_REWARD: "Daily reward",
  ADMIN_ADJUSTMENT: "League adjustment",
  COIN_FLIP_WAGER: "Coin Flip wager",
  COIN_FLIP_WIN: "Coin Flip win",
  BLACKJACK_WAGER: "Blackjack wager",
  BLACKJACK_PAYOUT: "Blackjack payout",
  HIGH_LOW_WAGER: "High-Low wager",
  HIGH_LOW_PAYOUT: "High-Low payout",
  BET_WAGER: "Fight bet",
  BET_PAYOUT: "Bet winnings",
  BET_REFUND: "Bet refund",
  PACK_PURCHASE: "Card pack",
  MARKET_PURCHASE: "Marketplace purchase",
  MARKET_SALE: "Marketplace sale",
  FIGHT_POOL_WIN: "Fighter Pool win",
  FIGHT_POOL_REVERSAL: "Fighter Pool result correction",
} as const;

export default async function PlayerHomePage() {
  const session = await auth();
  if (!session) redirect("/signin");
  if (session.user.status !== "ACTIVE") redirect("/signin?error=AccessDenied");
  if (!session.user.profileCompletedAt) redirect("/welcome");
  if (!session.user.legalOnboardingComplete) redirect("/welcome");
  const summary = await getWalletSummary(session.user.id);
  const balance = summary.wallet?.balance ?? 0;

  return (
    <main className="player-page">
      <SiteHeader />
      <section className="player-welcome">
        <p className="eyebrow"><span /> Your corner</p>
        <h1>Welcome, <em>{session.user.displayName}</em>.</h1>
        <p>Your RFL identity is ready. Your journey starts here.</p>
        <div className="player-summary">
          <div className="summary-icon"><Crown /></div>
          <div><span>Crown balance</span><strong>{balance.toLocaleString()}</strong></div>
          <p>Crowns are virtual rewards. They can never be purchased or redeemed for cash.</p>
        </div>
        <DailyReward amount={getEnv().DAILY_REWARD_AMOUNT} claimedToday={summary.claimedToday} />
        {session.user.wageringEligible && <Link className="casino-invite" href="/casino/coin-flip"><span><small>Realm Casino</small><strong>Think luck is on your side?</strong></span><b>Play Coin Flip →</b></Link>}
        {summary.wallet && summary.wallet.entries.length > 0 && (
          <section className="wallet-activity" aria-labelledby="activity-title">
            <div><p className="eyebrow"><span /> Wallet</p><h2 id="activity-title">Recent Crown activity</h2></div>
            <ul>
              {summary.wallet.entries.map((entry) => (
                <li key={entry.id}>
                  <span><Crown /> {activityLabels[entry.reason]}<small>{entry.createdAt.toLocaleDateString("en-US", { timeZone: "UTC" })} UTC</small></span>
                  <strong className={entry.delta < 0 ? "activity-negative" : ""}>{entry.delta > 0 ? "+" : ""}{entry.delta.toLocaleString()}</strong>
                </li>
              ))}
            </ul>
          </section>
        )}
      </section>
    </main>
  );
}
