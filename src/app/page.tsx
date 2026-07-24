import Link from "next/link";
import { auth } from "@/lib/auth";
import { SiteHeader } from "@/components/site-header";
import { getHomeContent } from "@/features/home/queries";
import { DailyReward } from "@/features/wallet/daily-reward";
import { getWalletSummary } from "@/features/wallet/wallet.service";
import { getEnv } from "@/lib/env";
import { Crown } from "@/components/crown";

function displayDate(date: Date) {
  return `${new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(date)} UTC`;
}

export default async function HomePage() {
  const session = await auth();
  const { announcement, featuredEvent, upcomingFights } = await getHomeContent();
  const reward = session?.user.profileCompletedAt ? await getWalletSummary(session.user.id) : null;
  const featuredFight = featuredEvent?.fights[0];
  const destination = session
    ? session.user.profileCompletedAt ? "/play" : "/welcome"
    : "/signin";

  return (
    <main className="home-page">
      <SiteHeader />
      {announcement && (
        <aside className="announcement" aria-label="Announcement">
          <span>RFL</span><p>{announcement.message}</p>
          {announcement.linkLabel && announcement.linkUrl && <Link href={announcement.linkUrl}>{announcement.linkLabel} →</Link>}
        </aside>
      )}
      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-content">
          <p className="eyebrow"><span /> Defend your bed. Destroy theirs.</p>
          <h1 id="hero-title">
            Fight for<br />
            <em>the realm.</em>
          </h1>
          <p className="hero-lede">
            Enter competitive BedWars battles, watch fight nights, earn Crowns, and build a collection worthy of the arena.
          </p>
          <div className="hero-actions">
            <Link className="button button-primary" href={destination}>
              {session ? "Enter the arena" : "Join with Discord"}
              <span aria-hidden="true">→</span>
            </Link>
            <Link className="button button-ghost" href="/live">Watch live</Link>
          </div>
          <div className="trust-row" aria-label="Platform promises">
            <span><i>✓</i> Crowns never cost real money</span>
            <span><i>✓</i> One secure Discord login</span>
          </div>
        </div>
      </section>

      <section className="home-quick-grid" aria-label="Explore Realm Fighting League">
        <Link className="home-quick-card quick-live" href={featuredEvent ? `/live/${featuredEvent.id}` : "/live"}>
          <span className="quick-card-label"><i /> {featuredEvent?.status === "LIVE" ? "Live event" : "Fight night"}</span>
          <strong>{featuredEvent?.title ?? "The next battle awaits"}</strong>
          <small>{featuredFight ? `${featuredFight.redFighter.name} vs ${featuredFight.blueFighter.name}` : "See events, matchups, and live results."}</small>
          <b>Watch live <span>→</span></b>
        </Link>
        <Link className="home-quick-card quick-crowns" href={session?.user.profileCompletedAt ? "/play" : "/signin"}>
          <span className="quick-card-label"><Crown /> Your Crowns</span>
          <strong>{reward?.wallet?.balance.toLocaleString() ?? "Earn rewards"}</strong>
          <small>Claim rewards and use your Crowns across RFL.</small>
          <b>View wallet <span>→</span></b>
        </Link>
        <Link className="home-quick-card quick-casino" href={session?.user.profileCompletedAt ? "/casino/coin-flip" : "/signin"}>
          <span className="quick-card-label">◉ Casino</span>
          <strong>Play your way</strong>
          <small>Coin Flip, Blackjack, and High-Low use Crowns only.</small>
          <b>Play now <span>→</span></b>
        </Link>
        <Link className="home-quick-card quick-cards" href="/cards">
          <span className="quick-card-label">◇ Cards</span>
          <strong>Collect legends</strong>
          <small>Open packs, build your collection, and trade.</small>
          <b>Open packs <span>→</span></b>
        </Link>
      </section>

      {reward && (
        <div className="reward-wrap">
          <DailyReward amount={getEnv().DAILY_REWARD_AMOUNT} claimedToday={reward.claimedToday} />
        </div>
      )}

      {upcomingFights.length > 0 && (
        <section className="fight-section" aria-labelledby="upcoming-title">
          <div className="section-heading">
            <div><p className="eyebrow"><span /> Fight schedule</p><h2 id="upcoming-title">Upcoming fights</h2></div>
            <p>Matchups confirmed by the RFL team.</p>
          </div>
          <div className="fight-grid">
            {upcomingFights.map((fight) => (
              <article className="fight-card" key={fight.id}>
                <div className="fight-meta"><span>{fight.event.title}</span><time dateTime={fight.event.startsAt.toISOString()}>{displayDate(fight.event.startsAt)}</time></div>
                <div className="matchup">
                  <div><span className="fighter-initial red-corner">{fight.redFighter.name[0]}</span><strong>{fight.redFighter.name}</strong><small>{fight.redFighter.wins}-{fight.redFighter.losses}-{fight.redFighter.draws}</small></div>
                  <b>VS</b>
                  <div><span className="fighter-initial blue-corner">{fight.blueFighter.name[0]}</span><strong>{fight.blueFighter.name}</strong><small>{fight.blueFighter.wins}-{fight.blueFighter.losses}-{fight.blueFighter.draws}</small></div>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      <section className="intro" id="what-is-rfl" aria-labelledby="intro-title">
        <p className="eyebrow"><span /> One league. Your story.</p>
        <h2 id="intro-title">Fight night should feel like <em>fight night.</em></h2>
        <p>RFL is being built around the moments that matter: the matchup, the choice, the result, and the reward.</p>
      </section>
    </main>
  );
}
