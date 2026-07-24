"use client";

import { useActionState, useMemo, useRef, useState } from "react";
import { Crown } from "@/components/crown";
import { playCoinFlipAction, type CoinFlipState } from "./coin-flip.actions";
import { CrownGainBurst } from "@/components/crown-gain-burst";

export function CoinFlipGame({
  initialBalance,
  minWager,
  maxWager,
  payoutBasisPoints,
}: {
  initialBalance: number;
  minWager: number;
  maxWager: number;
  payoutBasisPoints: number;
}) {
  const [state, action, pending] = useActionState(playCoinFlipAction, {} as CoinFlipState);
  const [choice, setChoice] = useState<"HEADS" | "TAILS">("HEADS");
  const [wager, setWager] = useState(String(minWager));
  const idempotencyInput = useRef<HTMLInputElement>(null);

  const balance = state.balance ?? initialBalance;
  const possiblePayout = useMemo(() => {
    const amount = Number(wager);
    return Number.isInteger(amount) && amount > 0 ? Math.floor(amount * payoutBasisPoints / 10_000) : 0;
  }, [wager, payoutBasisPoints]);

  return (
    <div className="coin-game-layout">
      <CrownGainBurst balance={balance} initialBalance={initialBalance} eventKey={state.roundId} />
      <section className="coin-stage" aria-label="Coin Flip result">
        <div className="table-light" aria-hidden="true" />
        <div className="coin-shadow" aria-hidden="true" />
        <div
          className={`game-coin ${state.roundId ? `coin-land-${state.result?.toLowerCase()}` : ""}`}
          key={state.roundId ?? "ready"}
          aria-hidden="true"
        >
          <div className="coin-face coin-heads"><span>R</span><small>Heads</small></div>
          <div className="coin-face coin-tails"><span>F</span><small>Tails</small></div>
        </div>
        <div className="coin-result" aria-live="polite">
          {pending ? (
            <><span className="result-kicker">In the air</span><strong>Flipping…</strong></>
          ) : state.roundId ? (
            <><span className="result-kicker">{state.result}</span><strong className={state.won ? "win-text" : "loss-text"}>{state.won ? `You won ${state.payout?.toLocaleString()} Crowns` : `You lost ${state.wager?.toLocaleString()} Crowns`}</strong></>
          ) : (
            <><span className="result-kicker">The Realm coin</span><strong>Choose your side</strong></>
          )}
        </div>
      </section>

      <section className="bet-panel" aria-labelledby="coin-controls-title">
        <div className="bet-panel-header"><div><p>Coin Flip</p><h1 id="coin-controls-title">Call it.</h1></div><span className="game-wallet"><Crown />{balance.toLocaleString()}</span></div>
        <form action={action} onSubmit={() => {
          if (idempotencyInput.current) idempotencyInput.current.value = crypto.randomUUID();
        }}>
          <input name="idempotencyKey" ref={idempotencyInput} type="hidden" />
          <fieldset className="side-picker">
            <legend>Pick a side</legend>
            <label className={choice === "HEADS" ? "selected" : ""}>
              <input checked={choice === "HEADS"} name="choice" onChange={() => setChoice("HEADS")} type="radio" value="HEADS" />
              <span>R</span><strong>Heads</strong>
            </label>
            <label className={choice === "TAILS" ? "selected" : ""}>
              <input checked={choice === "TAILS"} name="choice" onChange={() => setChoice("TAILS")} type="radio" value="TAILS" />
              <span>F</span><strong>Tails</strong>
            </label>
          </fieldset>

          <label className="wager-field" htmlFor="coin-wager"><span>Wager</span><div><Crown /><input id="coin-wager" inputMode="numeric" max={maxWager} min={minWager} name="wager" onChange={(event) => setWager(event.target.value)} step="1" type="number" value={wager} /></div><small>{minWager.toLocaleString()}–{maxWager.toLocaleString()} Crowns</small></label>
          <div className="bet-review"><span>Possible return<strong>{possiblePayout.toLocaleString()} Crowns</strong></span><span>Your call<strong>{choice === "HEADS" ? "Heads" : "Tails"}</strong></span></div>
          <button className="button button-primary button-wide flip-button" disabled={pending || Number(wager) > balance} type="submit">
            {pending ? "Coin in the air…" : "Flip coin"}
          </button>
          {Number(wager) > balance && <p className="game-error" role="alert">Your wager is higher than your Crown balance.</p>}
          {state.error && <p className="game-error" role="alert">{state.error}</p>}
        </form>
        <p className="fair-note"><span>◇</span> The server securely decides each 50/50 result before the animation reveals it.</p>
      </section>
    </div>
  );
}
