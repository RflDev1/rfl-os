import { auth } from "@/lib/auth";
import { getEnv } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { Crown } from "@/components/crown";
import { BetSlip } from "./bet-slip";
import { oddsLabel } from "./betting.logic";

export async function EventBetting({ eventId }: { eventId: string }) {
  const session = await auth();
  const markets = await prisma.betMarket.findMany({ where: { fight: { eventId } }, include: { fight: { include: { redFighter: true, blueFighter: true } } }, orderBy: { fight: { position: "asc" } } });
  const bets = session?.user.id ? await prisma.bet.findMany({ where: { userId: session.user.id, market: { fight: { eventId } } }, include: { market: { include: { fight: { include: { redFighter: true, blueFighter: true } } } } }, orderBy: { createdAt: "desc" }, take: 20 }) : [];
  if (markets.length === 0 && bets.length === 0) return null;
  const env = getEnv();
  const wallet = session?.user.id ? await prisma.wallet.findUnique({ where: { userId: session.user.id } }) : null;
  return <section className="event-betting"><div className="section-heading"><div><p className="eyebrow"><span /> Fight betting</p><h2>Back your fighter</h2></div><p>Winner markets lock before the fight begins.</p></div><div className="bet-market-list">{markets.map((market) => <article key={market.id}><header><span>Fight {market.fight.position}</span><b>{market.status}</b></header>{market.status === "OPEN" && session?.user.profileCompletedAt ? <BetSlip balance={wallet?.balance ?? 0} blueName={market.fight.blueFighter.name} blueOddsBps={market.blueOddsBps} marketId={market.id} maxStake={env.BET_MAX_WAGER} minStake={env.BET_MIN_WAGER} redName={market.fight.redFighter.name} redOddsBps={market.redOddsBps} /> : <div className="closed-market"><p>{market.fight.redFighter.name} <strong>{oddsLabel(market.redOddsBps)}</strong></p><span>vs</span><p>{market.fight.blueFighter.name} <strong>{oddsLabel(market.blueOddsBps)}</strong></p><small>{session ? `Betting ${market.status.toLowerCase()}` : "Sign in to place a bet"}</small></div>}</article>)}</div>{bets.length > 0 && <div className="bet-history"><h3>Your bets</h3>{bets.map((bet) => <article key={bet.id}><span>{bet.market.fight.redFighter.name} vs {bet.market.fight.blueFighter.name}</span><small>{bet.selection} · {oddsLabel(bet.acceptedOddsBps)}</small><strong className={bet.status === "WON" ? "win-text" : bet.status === "LOST" ? "loss-text" : ""}>{bet.status} · {bet.stake.toLocaleString()} <Crown /></strong></article>)}</div>}</section>;
}
