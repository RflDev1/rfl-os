import type { Metadata } from "next";
import { getEnv } from "@/lib/env";

export const metadata: Metadata = { title: "Production settings" };

export default function SettingsPage() {
  const env = getEnv();
  const groups = [{ title: "Application", values: [["Canonical origin", env.APP_URL], ["Runtime", env.NODE_ENV], ["Discord API", env.DISCORD_API_BASE_URL]] }, { title: "Crowns and betting", values: [["Daily reward", env.DAILY_REWARD_AMOUNT], ["Bet range", `${env.BET_MIN_WAGER}–${env.BET_MAX_WAGER}`], ["Market price range", `${env.MARKET_MIN_PRICE}–${env.MARKET_MAX_PRICE}`]] }, { title: "Casino limits", values: [["Coin Flip wager", `${env.COIN_FLIP_MIN_WAGER}–${env.COIN_FLIP_MAX_WAGER}`], ["Blackjack wager", `${env.BLACKJACK_MIN_WAGER}–${env.BLACKJACK_MAX_WAGER}`], ["High-Low wager", `${env.HIGH_LOW_MIN_WAGER}–${env.HIGH_LOW_MAX_WAGER}`]] }, { title: "Abuse limits", values: [["Bet placements/min", env.BET_MAX_PLACEMENTS_PER_MINUTE], ["Pack openings/min", env.PACK_MAX_OPENINGS_PER_MINUTE], ["Fight request rank range", `±${env.FIGHT_REQUEST_RANK_RANGE}`]] }];
  return <main className="admin-page"><div className="admin-title"><div><p>Environment-owned configuration</p><h1>Production settings</h1></div><span>Read-only · update through DigitalOcean environment variables</span></div><p className="settings-warning">Secrets, database credentials, OAuth credentials, and bot tokens are intentionally never displayed here.</p><div className="settings-grid">{groups.map((group) => <section className="admin-panel" key={group.title}><h2>{group.title}</h2><dl>{group.values.map(([label, value]) => <div key={String(label)}><dt>{label}</dt><dd>{String(value)}</dd></div>)}</dl></section>)}</div></main>;
}
