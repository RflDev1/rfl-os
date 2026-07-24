import { randomUUID } from "node:crypto";
import type { Metadata } from "next";
import { Crown } from "@/components/crown";
import { prisma } from "@/lib/prisma";
import { applyWalletAdjustment } from "@/features/wallet/admin.actions";
import { SearchableSelect } from "@/components/searchable-select";

export const metadata: Metadata = { title: "Economy" };

const reasonLabels = {
  DAILY_REWARD: "Daily reward",
  ADMIN_ADJUSTMENT: "Admin adjustment",
  COIN_FLIP_WAGER: "Coin Flip wager",
  COIN_FLIP_WIN: "Coin Flip win",
  BLACKJACK_WAGER: "Blackjack wager",
  BLACKJACK_PAYOUT: "Blackjack payout",
  HIGH_LOW_WAGER: "High-Low wager",
  HIGH_LOW_PAYOUT: "High-Low payout",
  BET_WAGER: "Fight bet",
  BET_PAYOUT: "Bet payout",
  BET_REFUND: "Bet refund",
  PACK_PURCHASE: "Card pack purchase",
  MARKET_PURCHASE: "Marketplace purchase",
  MARKET_SALE: "Marketplace sale",
} as const;

export default async function EconomyPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  const [{ notice, error }, users, recentEntries] = await Promise.all([
    searchParams,
    prisma.user.findMany({
      where: { status: "ACTIVE", profileCompletedAt: { not: null } },
      include: { wallet: true },
      orderBy: { displayName: "asc" },
      take: 200,
    }),
    prisma.walletEntry.findMany({
      include: { wallet: { include: { user: true } } },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  return (
    <main className="admin-page">
      <div className="admin-title"><div><p>Protected operation</p><h1>Crown economy</h1></div><span>Every change creates an immutable ledger entry</span></div>
      {notice && <p className="admin-notice" role="status">{notice}</p>}
      {error && <p className="admin-error" role="alert">{error}</p>}

      <div className="economy-layout">
        <section className="admin-panel">
          <div className="panel-heading"><span>01</span><div><h2>Adjust a wallet</h2><p>Use only to correct or award Crowns intentionally.</p></div></div>
          <form action={applyWalletAdjustment} className="admin-form">
            <input name="idempotencyKey" type="hidden" value={randomUUID()} />
            <SearchableSelect name="userId" label="Player" options={users.map((user) => ({ value: user.id, label: user.displayName ?? user.name ?? "Unnamed player", details: `${user.wallet?.balance ?? 0} Crowns` }))} searchPlaceholder="Search existing players…" />
            <label>Amount<input name="delta" type="number" min="-100000" max="100000" placeholder="Use a minus sign to remove Crowns" required /></label>
            <label>Reason<textarea name="note" minLength={8} maxLength={240} placeholder="Explain the correction for the audit record" required /></label>
            <label className="admin-check confirmation"><input name="confirmed" type="checkbox" required /> I reviewed the player, amount, and reason.</label>
            <button className="button button-primary" type="submit">Record adjustment</button>
          </form>
        </section>

        <section className="admin-panel">
          <div className="panel-heading"><span>02</span><div><h2>Recent activity</h2><p>Daily rewards and operator adjustments.</p></div></div>
          <div className="economy-entries">
            {recentEntries.length === 0 && <p className="admin-empty">No Crown activity yet.</p>}
            {recentEntries.map((entry) => (
              <div className="economy-entry" key={entry.id}>
                <span className={entry.delta > 0 ? "positive" : "negative"}><Crown />{entry.delta > 0 ? "+" : ""}{entry.delta.toLocaleString()}</span>
                <div><strong>{entry.wallet.user.displayName ?? entry.wallet.user.name ?? "Player"}</strong><small>{reasonLabels[entry.reason]}</small></div>
                <time>{entry.createdAt.toLocaleString("en-US", { timeZone: "UTC" })} UTC</time>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
