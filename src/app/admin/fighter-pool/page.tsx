import type { Metadata } from "next";
import { SearchableSelect } from "@/components/searchable-select";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/features/admin/authorization";
import {
  cancelSoloTestMatchAction,
  createSoloTestMatchAction,
  joinSoloQueueAction,
  recordSoloTestRoundAction,
  resetSoloTestStateAction,
  reviewPoolMatchAction,
  simulateSoloPresenceAction,
} from "@/features/fighter-pool/fighter-pool.actions";

export const metadata: Metadata = { title: "Fighter Pool operations" };

export default async function AdminFighterPoolPage({ searchParams }: { searchParams: Promise<{ notice?: string; error?: string }> }) {
  await requireAdmin();
  const query = await searchParams;
  const [matches, queue, servers, fighters] = await Promise.all([
    prisma.fighterPoolMatch.findMany({ include: { redFighter: true, blueFighter: true, winnerFighter: true, assignedServer: true, reviews: { orderBy: { createdAt: "desc" } } }, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.fighterPoolQueueEntry.findMany({ include: { fighter: true }, orderBy: { joinedAt: "asc" } }),
    prisma.fighterPoolServer.findMany({ orderBy: [{ kind: "asc" }, { id: "asc" }] }),
    prisma.fighter.findMany({ where: { status: "ACTIVE", userId: { not: null }, rank: { not: null }, minecraftUsernameNormalized: { not: null } }, orderBy: [{ rank: "asc" }, { name: "asc" }] }),
  ]);
  const fighterOptions = fighters.map((fighter) => ({ value: fighter.id, label: `#${fighter.rank} ${fighter.name}`, details: `${fighter.minecraftUsername} · ${fighter.wins}-${fighter.losses}-${fighter.draws}` }));
  const activeTestMatch = matches.find((match) => match.assignedServer?.id === "admin-solo-test" && ["AWAITING_CHECKIN", "READY", "LIVE"].includes(match.status));

  return <main className="admin-page">
    <div className="admin-title"><div><p>Automated competition</p><h1>Fighter Pool</h1></div><span>Queue, server health, results, and disputes</span></div>
    {query.notice && <p className="admin-notice" role="status">{query.notice}</p>}
    {query.error && <p className="admin-error" role="alert">{query.error}</p>}

    <section className="admin-panel">
      <div className="panel-heading"><span>TEST</span><div><h2>Solo end-to-end testing</h2><p>Simulate the lobby, queue, matchmaking, rounds, results, rankings, and rewards.</p></div></div>
      <p className="admin-error" role="note"><strong>These are not harmless test results.</strong> Completing a simulated match adds a real win and loss, may swap ranks, and awards the configured Fighter Pool Crowns.</p>
      <div className="admin-grid">
        <form action={simulateSoloPresenceAction} className="admin-form">
          <SearchableSelect name="fighterId" label="Fighter for lobby simulation" options={fighterOptions} searchPlaceholder="Search fighter, rank, or gamertag…" />
          <button className="button button-ghost">Simulate lobby presence</button>
          <button className="button button-primary" formAction={joinSoloQueueAction}>Simulate presence and join queue</button>
        </form>
        <form action={createSoloTestMatchAction} className="admin-form">
          <SearchableSelect name="redFighterId" label="Red fighter" options={fighterOptions} searchPlaceholder="Search red fighter…" />
          <SearchableSelect name="blueFighterId" label="Blue fighter" options={fighterOptions} searchPlaceholder="Search blue fighter…" />
          <p className="admin-guidance">Both fighters are checked in automatically. They must be active and within the configured five-rank range.</p>
          <button className="button button-primary">Create solo test match</button>
        </form>
      </div>
      {activeTestMatch ? <div className="pool-match-review">
        <h3>{activeTestMatch.redFighter.name} vs {activeTestMatch.blueFighter.name}</h3>
        <p><strong>{activeTestMatch.redRoundWins}-{activeTestMatch.blueRoundWins}</strong> · {activeTestMatch.status}</p>
        <div className="form-row">
          <form action={recordSoloTestRoundAction}><input name="matchId" type="hidden" value={activeTestMatch.id} /><button className="button button-primary" name="winnerFighterId" value={activeTestMatch.redFighterId}>{activeTestMatch.redFighter.name} wins round</button></form>
          <form action={recordSoloTestRoundAction}><input name="matchId" type="hidden" value={activeTestMatch.id} /><button className="button button-primary" name="winnerFighterId" value={activeTestMatch.blueFighterId}>{activeTestMatch.blueFighter.name} wins round</button></form>
          <form action={cancelSoloTestMatchAction}><input name="matchId" type="hidden" value={activeTestMatch.id} /><button className="button button-danger">Cancel test match</button></form>
        </div>
      </div> : <p className="admin-guidance">No solo test match is active.</p>}
      <form action={resetSoloTestStateAction}><button className="button button-danger">Reset solo test presence and active match</button></form>
    </section>

    <div className="admin-grid">
      <section className="admin-panel"><div className="panel-heading"><span>01</span><div><h2>Server status</h2><p>Heartbeats must remain current.</p></div></div>{servers.length ? servers.map((server) => <div className="pool-admin-row" key={server.id}><div><strong>{server.id}</strong><small>{server.kind} · {server.publicAddress}:{server.port}</small></div><b>{server.status}</b></div>) : <p className="admin-guidance">No Minecraft servers have checked in.</p>}</section>
      <section className="admin-panel"><div className="panel-heading"><span>02</span><div><h2>Current queue</h2><p>{queue.length} fighters waiting.</p></div></div>{queue.map((entry, index) => <div className="pool-admin-row" key={entry.id}><strong>#{index + 1} · {entry.fighter.name}</strong><small>Rank #{entry.rank}</small></div>)}{!queue.length && <p className="admin-guidance">The queue is empty.</p>}</section>
    </div>

    <section className="admin-panel"><div className="panel-heading"><span>03</span><div><h2>Past and active matches</h2><p>Open a match to review its complete result.</p></div></div><div className="pool-admin-matches">{matches.map((match) => <details key={match.id}><summary><span><strong>{match.redFighter.name} vs {match.blueFighter.name}</strong><small>{match.createdAt.toLocaleString("en-US")} · {match.redRoundWins}-{match.blueRoundWins}</small></span><b>{match.resultDisposition === "ORIGINAL" ? match.status : match.resultDisposition}</b></summary><div className="pool-match-review"><dl><div><dt>Match ID</dt><dd>{match.id}</dd></div><div><dt>Original server report</dt><dd>{match.resultReportId ?? "Not received"}</dd></div><div><dt>Current winner</dt><dd>{match.winnerFighter?.name ?? "Voided / undecided"}</dd></div><div><dt>Reward</dt><dd>{match.rewardAmount.toLocaleString()} Crowns</dd></div><div><dt>Arena</dt><dd>{match.assignedServer?.id ?? "Released"}</dd></div></dl>{match.reviews.length ? <div className="admin-guidance"><strong>Final review: {match.reviews[0].action}</strong><p>{match.reviews[0].reason}</p><small>{match.reviews[0].createdAt.toLocaleString("en-US")}</small></div> : match.status === "COMPLETED" ? <form action={reviewPoolMatchAction} className="admin-form"><input name="matchId" type="hidden" value={match.id} /><label>Decision<select name="action"><option value="UPHOLD">Uphold original result</option><option value="REVERSE">Reverse winner and loser</option><option value="VOID">Void the fight</option></select></label><label>Reason<textarea name="reason" minLength={10} maxLength={500} required /></label><label>Type CONFIRM<input name="confirmation" required autoComplete="off" /></label><button className="button button-primary">Save final review</button></form> : <p className="admin-guidance">Review controls become available after the server submits a completed result.</p>}</div></details>)}</div></section>
  </main>;
}
