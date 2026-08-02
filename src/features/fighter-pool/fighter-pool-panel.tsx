"use client";

import { useEffect, useRef, useState } from "react";
import { joinFighterPoolAction, leaveFighterPoolAction } from "./fighter-pool.actions";

type PoolState = {
  enabled: boolean; inLobby: boolean; queuePosition: number | null;
  fighter: null | { name: string; rank: number | null; status: string; minecraftUsername: string | null; poolQueueEntry: unknown };
  match: null | { id: string; status: string; opponent: string; code: string; expiresAt: string; serverAddress: string | null; serverPort: number | null; checkedIn: boolean };
};

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
  if (state.match) return <section className="pool-match-found" aria-live="polite"><p className="eyebrow"><span /> Match ready</p><h2>We found a match for you!</h2><p className="pool-opponent">You are fighting <strong>{state.match.opponent}</strong></p><div className="pool-code"><span>Your private fight code</span><strong>{state.match.code}</strong></div><dl><div><dt>Arena</dt><dd>{state.match.serverAddress ? `${state.match.serverAddress}:${state.match.serverPort}` : "Preparing…"}</dd></div><div><dt>Check-in</dt><dd>{state.match.checkedIn ? "Confirmed" : "Enter your code in Minecraft"}</dd></div><div><dt>Format</dt><dd>Best of three</dd></div></dl><p>Do not share this code. It expires at {new Date(state.match.expiresAt).toLocaleTimeString()}.</p></section>;
  if (state.queuePosition) return <section className="pool-status-card" aria-live="polite"><h2>You’re in the Fighter Pool</h2><p>Queue position: <strong>#{state.queuePosition}</strong></p><p>Stay inside the RFL lobby. This page will update automatically when an eligible opponent is found.</p><form action={leaveFighterPoolAction}><button className="button button-ghost">Leave Fighter Pool</button></form></section>;
  return <section className="pool-status-card"><h2>Ready for an official fight?</h2><p aria-live="polite" aria-atomic="true" className={state.inLobby ? "pool-presence-ready" : "pool-presence-missing"}>{state.inLobby ? "✓ RFL lobby presence confirmed" : "Join the RFL Bedrock lobby before entering."}</p><p>Bedrock players: If you suspect someone is cheating, please record a clip and open a support ticket.</p><form action={joinFighterPoolAction}><button className="button button-primary" disabled={!state.inLobby}>Join Fighter Pool</button></form></section>;
}
