"use client";

import { useActionState, useRef, useState } from "react";
import { Crown } from "@/components/crown";
import { blackjackAction, type BlackjackState } from "./blackjack.actions";
import { CrownGainBurst } from "@/components/crown-gain-burst";

const suitSymbols = { S: "♠", H: "♥", D: "♦", C: "♣" } as const;

function PlayingCard({ card, index, hidden, skipMotion }: { card: string | null; index: number; hidden?: boolean; skipMotion: boolean }) {
  if (hidden || !card) return <div className="playing-card card-back" aria-label="Hidden dealer card"><span>RFL</span></div>;
  const suit = card.slice(-1) as keyof typeof suitSymbols;
  const rank = card.slice(0, -1);
  const red = suit === "H" || suit === "D";
  return (
    <div className={`playing-card ${red ? "red-suit" : ""} ${skipMotion ? "skip-deal" : ""}`} style={{ animationDelay: `${index * 90}ms` }} aria-label={`${rank} of ${suit === "S" ? "spades" : suit === "H" ? "hearts" : suit === "D" ? "diamonds" : "clubs"}`}>
      <span className="card-corner">{rank}<small>{suitSymbols[suit]}</small></span>
      <b>{suitSymbols[suit]}</b>
      <span className="card-corner card-corner-bottom">{rank}<small>{suitSymbols[suit]}</small></span>
    </div>
  );
}

function outcomeCopy(outcome?: string | null) {
  const labels: Record<string, string> = {
    PLAYER_BLACKJACK: "Blackjack!",
    PLAYER_WIN: "You win",
    DEALER_WIN: "Dealer wins",
    PUSH: "Push — wager returned",
    PLAYER_BUST: "Bust — dealer wins",
    DEALER_BUST: "Dealer busts — you win",
  };
  return outcome ? labels[outcome] ?? outcome : "";
}

export function BlackjackTable({
  initialState,
  initialBalance,
  minWager,
  maxWager,
  naturalReturnLabel,
}: {
  initialState: BlackjackState;
  initialBalance: number;
  minWager: number;
  maxWager: number;
  naturalReturnLabel: string;
}) {
  const [state, action, pending] = useActionState(blackjackAction, initialState);
  const [wager, setWager] = useState(String(minWager));
  const [skipMotion, setSkipMotion] = useState(false);
  const keyInput = useRef<HTMLInputElement>(null);
  const active = state.status === "ACTIVE";
  const balance = state.balance ?? initialBalance;

  return (
    <section className="blackjack-table" aria-label="Blackjack table">
      <CrownGainBurst balance={balance} initialBalance={initialBalance} eventKey={state.status === "SETTLED" ? state.roundId : false} />
      <div className="felt-mark" aria-hidden="true"><span>RFL</span><small>Natural returns {naturalReturnLabel}</small></div>
      <div className="dealer-zone hand-zone">
        <div className="hand-label"><span>Dealer</span>{state.dealerCards && <b>{active ? `${state.dealerTotal} + ?` : state.dealerTotal}</b>}</div>
        <div className="card-hand">
          {(state.dealerCards ?? []).map((card, index) => <PlayingCard card={card} hidden={card === null} index={index} key={`${card}-${index}-${state.roundId}`} skipMotion={skipMotion} />)}
        </div>
      </div>

      <div className="blackjack-message" aria-live="polite">
        {pending ? <><small>Dealer</small><strong>Dealing…</strong></> : state.status === "SETTLED" ? <><small>Hand complete</small><strong className={state.outcome?.includes("WIN") || state.outcome === "DEALER_BUST" || state.outcome === "PLAYER_BLACKJACK" ? "win-text" : state.outcome === "PUSH" ? "push-text" : "loss-text"}>{outcomeCopy(state.outcome)}</strong>{state.payout !== undefined && state.payout > 0 && <span>{state.payout.toLocaleString()} Crowns returned</span>}</> : active ? <><small>Your move</small><strong>Hit, stand, or double</strong></> : <><small>Realm Casino</small><strong>Place your wager</strong></>}
      </div>

      <div className="player-zone hand-zone">
        <div className="hand-label"><span>Your hand</span>{state.playerCards && <b>{state.playerTotal}</b>}</div>
        <div className="card-hand">
          {(state.playerCards ?? []).map((card, index) => <PlayingCard card={card} index={index} key={`${card}-${index}-${state.roundId}`} skipMotion={skipMotion} />)}
        </div>
      </div>

      <form action={action} className="blackjack-controls" onSubmit={() => {
        if (keyInput.current) keyInput.current.value = crypto.randomUUID();
      }}>
        <input name="idempotencyKey" ref={keyInput} type="hidden" />
        <input name="roundId" type="hidden" value={state.roundId ?? ""} />
        <div className="table-wallet"><Crown /><span>Balance</span><strong>{balance.toLocaleString()}</strong></div>
        {active ? (
          <div className="move-buttons">
            <button className="button button-ghost" disabled={pending} name="intent" type="submit" value="HIT">Hit</button>
            <button className="button button-primary" disabled={pending} name="intent" type="submit" value="STAND">Stand</button>
            <button className="button button-ghost" disabled={pending || !state.canDouble || balance < (state.wager ?? 0)} name="intent" type="submit" value="DOUBLE">Double <small>+{state.wager?.toLocaleString()}</small></button>
          </div>
        ) : (
          <div className="new-hand-controls">
            <label htmlFor="blackjack-wager">Wager <span><Crown /><input id="blackjack-wager" max={maxWager} min={minWager} name="wager" onChange={(event) => setWager(event.target.value)} step="1" type="number" value={wager} /></span></label>
            <button className="button button-primary" disabled={pending || Number(wager) > balance} name="intent" type="submit" value="START">Deal cards</button>
          </div>
        )}
        <button className="skip-motion" onClick={() => setSkipMotion((value) => !value)} type="button">{skipMotion ? "Enable deal motion" : "Skip deal motion"}</button>
        {state.error && <p className="game-error" role="alert">{state.error}</p>}
      </form>
    </section>
  );
}
