"use client";

import { useActionState, useRef, useState } from "react";
import { Crown } from "@/components/crown";
import { highLowAction, type HighLowState } from "./high-low.actions";
import { multiplierLabel } from "./high-low.logic";
import { CrownGainBurst } from "@/components/crown-gain-burst";

const symbols = { S: "♠", H: "♥", D: "♦", C: "♣" } as const;
function Card({ card, small = false }: { card: string; small?: boolean }) {
  const suit = card.slice(-1) as keyof typeof symbols;
  const rank = card.slice(0, -1);
  return <div className={`high-low-card ${small ? "small" : ""} ${suit === "H" || suit === "D" ? "red-suit" : ""}`}><span>{rank}<small>{symbols[suit]}</small></span><b>{symbols[suit]}</b></div>;
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
        <div className="run-progress"><span>Run progress</span><div>{Array.from({ length: state.maxSteps ?? 7 }, (_, index) => <i className={index < (state.step ?? 0) ? "complete" : ""} key={index} />)}</div><b>{state.step ?? 0}/{state.maxSteps ?? 7}</b></div>
        <div className="reveal-trail">{(state.history ?? []).slice(-4).map((item, index) => <span key={`${item.card}-${index}`}><Card card={item.card} small /><i className={item.correct ? "correct" : "wrong"}>{item.correct ? "✓" : "×"}</i></span>)}</div>
        <div className="current-reveal">{state.currentCard ? <Card card={state.currentCard} /> : <div className="high-low-card card-back"><b>RFL</b></div>}<p>{active ? "Will the next card be higher or lower?" : state.status === "SETTLED" ? resultText : "Start a run to reveal the first card."}</p></div>
      </div>

      <form action={action} className="high-low-controls" onSubmit={() => { if (keyInput.current) keyInput.current.value = crypto.randomUUID(); }}>
        <input name="idempotencyKey" ref={keyInput} type="hidden" /><input name="roundId" type="hidden" value={state.roundId ?? ""} />
        <div className="high-low-summary"><span><Crown /> Balance<strong>{balance.toLocaleString()}</strong></span><span>Current return<strong>{multiplierLabel(state.multiplierBps ?? 10_000)}</strong></span><span>Cash-out value<strong>{potential.toLocaleString()}</strong></span></div>
        {active ? <div className="guess-controls"><button className="button higher-button" disabled={pending || state.higherNextBps === null} name="intent" value="HIGHER">↑ Higher <small>{state.higherNextBps ? multiplierLabel(state.higherNextBps) : "Unavailable"}</small></button><button className="button lower-button" disabled={pending || state.lowerNextBps === null} name="intent" value="LOWER">↓ Lower <small>{state.lowerNextBps ? multiplierLabel(state.lowerNextBps) : "Unavailable"}</small></button><button className="button button-primary" disabled={pending || (state.step ?? 0) < 1} name="intent" value="CASH_OUT">Cash out {potential.toLocaleString()}</button></div> : <div className="new-hand-controls"><label htmlFor="high-low-wager">Wager <span><Crown /><input id="high-low-wager" max={maxWager} min={minWager} name="wager" onChange={(event) => setWager(event.target.value)} step="1" type="number" value={wager} /></span></label><button className="button button-primary" disabled={pending || Number(wager) > balance} name="intent" value="START">Start run</button></div>}
        {state.error && <p className="game-error" role="alert">{state.error}</p>}
        <p className="fair-note"><span>◇</span> Ace is high. Equal ranks count as a losing tie. Each reveal is server-controlled.</p>
      </form>
    </section>
  );
}
