"use client";

import { useActionState, useRef, useState } from "react";
import { Crown } from "@/components/crown";
import { highLowAction, type HighLowState } from "./high-low.actions";
import { multiplierLabel } from "./high-low.logic";
import { CrownGainBurst } from "@/components/crown-gain-burst";

const symbols = { S: "♠", H: "♥", D: "♦", C: "♣" } as const;
const suitNames = { S: "spades", H: "hearts", D: "diamonds", C: "clubs" } as const;
function Card({ card, small = false }: { card: string; small?: boolean }) {
  const suit = card.slice(-1) as keyof typeof symbols;
  const rank = card.slice(0, -1);
  return <div aria-label={`${rank} of ${suitNames[suit]}`} className={`high-low-card ${small ? "small" : ""} ${suit === "H" || suit === "D" ? "red-suit" : ""}`} role="img"><span aria-hidden="true">{rank}<small>{symbols[suit]}</small></span><b aria-hidden="true">{symbols[suit]}</b></div>;
}

export function HighLowGame({ initialState, initialBalance, minWager, maxWager }: { initialState: HighLowState; initialBalance: number; minWager: number; maxWager: number }) {
  const [state, action, pending] = useActionState(highLowAction, initialState);
  const [wager, setWager] = useState(String(minWager));
  const keyInput = useRef<HTMLInputElement>(null);
  const active = state.status === "ACTIVE";
  const balance = state.balance ?? initialBalance;
  const potential = state.wager && state.multiplierBps ? Math.floor(state.wager * state.multiplierBps / 10_000) : 0;
  const resultText = state.outcome === "CASHED_OUT" ? "Cashed out" : state.outcome === "MAX_STEPS" ? "Perfect run" : state.outcome === "TIE" ? "Tie — run lost" : state.outcome === "WRONG_GUESS" ? "Wrong call" : "";

  return (
    <section className="high-low-game">
      <CrownGainBurst balance={balance} initialBalance={initialBalance} eventKey={state.status === "SETTLED" ? state.roundId : false} />
      <div className="high-low-stage">
        <div aria-label="High-Low run progress" aria-valuemax={state.maxSteps ?? 7} aria-valuemin={0} aria-valuenow={state.step ?? 0} className="run-progress" role="progressbar"><span>Run progress</span><div aria-hidden="true">{Array.from({ length: state.maxSteps ?? 7 }, (_, index) => <i className={index < (state.step ?? 0) ? "complete" : ""} key={index} />)}</div><b aria-hidden="true">{state.step ?? 0}/{state.maxSteps ?? 7}</b></div>
        <div className="reveal-trail">{(state.history ?? []).slice(-4).map((item, index) => <span key={`${item.card}-${index}`}><Card card={item.card} small /><i className={item.correct ? "correct" : "wrong"}>{item.correct ? "✓" : "×"}</i></span>)}</div>
        <div className="current-reveal">{state.currentCard ? <Card card={state.currentCard} /> : <div aria-label="Face-down card" className="high-low-card card-back" role="img"><b aria-hidden="true">RFL</b></div>}<p aria-live="polite">{active ? "Will the next card be higher or lower?" : state.status === "SETTLED" ? resultText : "Start a run to reveal the first card."}</p></div>
      </div>

      <form action={action} className="high-low-controls" onSubmit={() => { if (keyInput.current) keyInput.current.value = crypto.randomUUID(); }}>
        <input name="idempotencyKey" ref={keyInput} type="hidden" /><input name="roundId" type="hidden" value={state.roundId ?? ""} />
        <div className="high-low-summary"><span><Crown /> Balance<strong>{balance.toLocaleString()}</strong></span><span>Current return<strong>{multiplierLabel(state.multiplierBps ?? 10_000)}</strong></span><span>Cash-out value<strong>{potential.toLocaleString()}</strong></span></div>
        {active ? <div className="guess-controls"><button className="button higher-button" disabled={pending || state.higherNextBps === null} name="intent" type="submit" value="HIGHER">↑ Higher <small>{state.higherNextBps ? multiplierLabel(state.higherNextBps) : "Unavailable"}</small></button><button className="button lower-button" disabled={pending || state.lowerNextBps === null} name="intent" type="submit" value="LOWER">↓ Lower <small>{state.lowerNextBps ? multiplierLabel(state.lowerNextBps) : "Unavailable"}</small></button><button className="button button-primary" disabled={pending || (state.step ?? 0) < 1} name="intent" type="submit" value="CASH_OUT">Cash out {potential.toLocaleString()}</button></div> : <div className="new-hand-controls"><label htmlFor="high-low-wager">Wager <span><Crown /><input id="high-low-wager" max={maxWager} min={minWager} name="wager" onChange={(event) => setWager(event.target.value)} step="1" type="number" value={wager} /></span></label><button className="button button-primary" disabled={pending || Number(wager) > balance} name="intent" type="submit" value="START">Start run</button></div>}
        {state.error && <p className="game-error" role="alert">{state.error}</p>}
        <p className="fair-note"><span>◇</span> Ace is high. Equal ranks count as a losing tie. Each reveal is server-controlled.</p>
      </form>
    </section>
  );
}
