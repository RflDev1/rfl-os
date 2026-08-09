"use client";

import { useEffect, useRef, useState } from "react";
import { cancelFighterPoolMatchAction, joinFighterPoolAction, leaveFighterPoolAction } from "./fighter-pool.actions";

type PoolState = {
  enabled: boolean; inLobby: boolean; queuePosition: number | null;
  fighter: null | { name: string; rank: number | null; status: string; minecraftUsername: string | null; poolQueueEntry: unknown };
  match: null | {
    id: string; status: string; opponent: string; code: string | null; expiresAt: string; serverAddress: string | null; serverPort: number | null; checkedIn: boolean; canCancel: boolean;
    checkIn: { red: MatchPlayer & { checkedIn: boolean }; blue: MatchPlayer & { checkedIn: boolean } };
    live: null | { red: MatchPlayer & { checkedIn: boolean; roundWins: number }; blue: MatchPlayer & { checkedIn: boolean; roundWins: number }; currentRound: number | null; countdownSeconds: number | null; countdownStartedAt: string | null; disconnectedUsername: string | null; reconnectDeadlineAt: string | null; winnerFighterName: string | null; rounds: Array<{ roundId: string; roundNumber: number; winnerTeam: string; winnerMinecraftUsername: string; redRoundWins: number; blueRoundWins: number }> };
  };
};

type MatchPlayer = { fighterName: string; minecraftUsername: string | null };

function LiveMatchSummary({ match }: { match: NonNullable<PoolState["match"]> }) {
  const live = match.live!;
  const [now, setNow] = useState(0);
  useEffect(() => {
    if (!live.countdownStartedAt || live.countdownSeconds === null) return;
    const initialTimer = window.setTimeout(() => setNow(Date.now()), 0);
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => { window.clearTimeout(initialTimer); window.clearInterval(timer); };
  }, [live.countdownSeconds, live.countdownStartedAt]);
  const countdown = live.countdownStartedAt && live.countdownSeconds !== null ? Math.max(0, Math.ceil(live.countdownSeconds - ((now || new Date(live.countdownStartedAt).getTime()) - new Date(live.countdownStartedAt).getTime()) / 1000)) : null;
  const disconnected = live.disconnectedUsername?.toLocaleLowerCase("en-US");
  return <section className="pool-match-found pool-live-summary" aria-live="polite">
    <p className="eyebrow"><span /> {match.status === "COMPLETED" ? "Official result" : countdown && countdown > 0 ? "Round countdown" : "Match live"}</p>
    <h2>{match.status === "COMPLETED" ? `${live.winnerFighterName ?? "Winner"} wins` : countdown && countdown > 0 ? `Round ${live.currentRound} begins in ${countdown} seconds` : `Round ${live.currentRound ?? 1} in progress`}</h2>
    <div className="pool-series-score" aria-label={`Series score: Red ${live.red.roundWins}, Blue ${live.blue.roundWins}`}>
      <article className="pool-team-red"><span>Red</span><strong>{live.red.fighterName}</strong><small>{live.red.minecraftUsername}</small><b>{live.red.roundWins}</b>{disconnected === live.red.minecraftUsername?.toLocaleLowerCase("en-US") ? <em>Disconnected — reconnect by {live.reconnectDeadlineAt ? new Date(live.reconnectDeadlineAt).toLocaleTimeString() : "soon"}</em> : null}</article>
      <span className="pool-score-divider">–</span>
      <article className="pool-team-blue"><span>Blue</span><strong>{live.blue.fighterName}</strong><small>{live.blue.minecraftUsername}</small><b>{live.blue.roundWins}</b>{disconnected === live.blue.minecraftUsername?.toLocaleLowerCase("en-US") ? <em>Disconnected — reconnect by {live.reconnectDeadlineAt ? new Date(live.reconnectDeadlineAt).toLocaleTimeString() : "soon"}</em> : null}</article>
    </div>
    <div className="pool-round-history"><h3>Rounds</h3>{live.rounds.length ? <ol>{live.rounds.map((round) => <li key={round.roundId}><span>Round {round.roundNumber}</span><strong>{round.winnerMinecraftUsername} ({round.winnerTeam === "RED" ? "Red" : "Blue"})</strong></li>)}</ol> : <p>Round results will appear here immediately.</p>}</div>
  </section>;
}

export function FighterPoolPanel({ initialState }: { initialState: PoolState }) {
  const [state, setState] = useState(initialState);
  const requestInFlight = useRef(false);

  useEffect(() => {
    let stopped = false;
    let timer: number | undefined;

    const schedule = () => {
      if (!stopped) timer = window.setTimeout(refresh, 2_000);
    };

    const refresh = async () => {
      if (stopped || requestInFlight.current) return;
      requestInFlight.current = true;
      try {
        const response = await fetch(`/api/fighter-pool/state?time=${Date.now()}`, {
          cache: "no-store",
          credentials: "same-origin",
          headers: { Accept: "application/json" },
        });
        if (response.ok && !stopped) setState(await response.json());
      } catch {
        // A temporary connection failure should not stop future live updates.
      } finally {
        requestInFlight.current = false;
        schedule();
      }
    };

    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };

    void refresh();
    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);

    return () => {
      stopped = true;
      if (timer) window.clearTimeout(timer);
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, []);

  if (!state.enabled) return <div className="pool-status-card"><h2>Fighter Pool is currently closed</h2><p>The server connection is being prepared.</p></div>;
  if (!state.fighter || state.fighter.status !== "ACTIVE") return <div className="pool-status-card"><h2>Active fighters only</h2><p>An active RFL fighter profile is required to enter this queue.</p></div>;
  if (!state.fighter.minecraftUsername) return <div className="pool-status-card"><h2>Bedrock gamertag required</h2><p>Ask an administrator to add your private Minecraft Bedrock gamertag.</p></div>;
  if (state.match?.live) return <LiveMatchSummary match={state.match} />;
  if (state.match) return <section className="pool-match-found" aria-live="polite"><p className="eyebrow"><span /> Match ready</p><h2>We found a match for you!</h2><p className="pool-opponent">You are fighting <strong>{state.match.opponent}</strong></p><div className="pool-code"><span>Your private fight code</span><strong>{state.match.code}</strong></div><dl><div><dt>Arena</dt><dd>{state.match.serverAddress ? `${state.match.serverAddress}:${state.match.serverPort}` : "Preparing…"}</dd></div><div><dt>Your check-in</dt><dd>{state.match.checkedIn ? "Verified" : "Enter /fight CODE in Minecraft"}</dd></div><div><dt>Format</dt><dd>Best of three</dd></div></dl><div className="pool-checkin-list"><p><strong>Red — {state.match.checkIn.red.fighterName}</strong> ({state.match.checkIn.red.minecraftUsername}): {state.match.checkIn.red.checkedIn ? "Verified" : "Pending"}</p><p><strong>Blue — {state.match.checkIn.blue.fighterName}</strong> ({state.match.checkIn.blue.minecraftUsername}): {state.match.checkIn.blue.checkedIn ? "Verified" : "Pending"}</p></div><p>Do not share this code. It expires at {new Date(state.match.expiresAt).toLocaleTimeString()}.</p>{state.match.canCancel ? <form action={cancelFighterPoolMatchAction}><button className="button button-ghost">Cancel unstarted match</button><p>Cancelling releases the arena for both fighters. This option disappears when Minecraft gameplay begins.</p></form> : null}</section>;
  if (state.queuePosition) return <section className="pool-status-card" aria-live="polite"><h2>You’re in the Fighter Pool</h2><p>Queue position: <strong>#{state.queuePosition}</strong></p><p>Stay inside the RFL lobby. This page will update automatically when an eligible opponent is found.</p><form action={leaveFighterPoolAction}><button className="button button-ghost">Leave Fighter Pool</button></form></section>;
  return <section className="pool-status-card"><h2>Ready for an official fight?</h2><p aria-live="polite" aria-atomic="true" className={state.inLobby ? "pool-presence-ready" : "pool-presence-missing"}>{state.inLobby ? "✓ RFL lobby presence confirmed" : "Join the RFL Bedrock lobby before entering."}</p><p>Bedrock players: If you suspect someone is cheating, please record a clip and open a support ticket.</p><form action={joinFighterPoolAction}><button className="button button-primary" disabled={!state.inLobby}>Join Fighter Pool</button></form></section>;
}
