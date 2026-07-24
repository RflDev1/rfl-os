"use client";

import { useActionState, useEffect, useRef } from "react";
import { Crown } from "@/components/crown";
import { claimDailyRewardAction, type RewardState } from "./wallet.actions";
import { CrownGainBurst } from "@/components/crown-gain-burst";

export function DailyReward({ amount, claimedToday }: { amount: number; claimedToday: boolean }) {
  const initialState: RewardState = { claimed: false };
  const [state, action, pending] = useActionState(claimDailyRewardAction, initialState);
  const announced = useRef(false);
  const complete = claimedToday || state.claimed === true || (state.claimed === false && state.amount !== undefined);

  useEffect(() => {
    if (state.claimed && !announced.current) announced.current = true;
  }, [state.claimed]);

  return (
    <section className={`reward-card ${state.claimed ? "reward-card-won" : ""}`} aria-labelledby="reward-title">
      <CrownGainBurst amount={state.amount} eventKey={state.claimed} />
      <div className="reward-orbit" aria-hidden="true"><Crown /></div>
      <div className="reward-copy">
        <p className="eyebrow"><span /> Daily reward</p>
        <h2 id="reward-title">{complete ? "Reward secured." : "Your Crowns are waiting."}</h2>
        <p>{complete ? "Come back after 00:00 UTC for your next reward." : "Claim today’s reward and keep building your RFL legacy."}</p>
      </div>
      <div className="reward-action">
        <strong><Crown /> {amount.toLocaleString()}</strong>
        <form action={action}>
          <button className="button button-primary" disabled={complete || pending} type="submit">
            {pending ? "Claiming…" : complete ? "Claimed today" : "Claim reward"}
          </button>
        </form>
      </div>
      {state.error && <p className="reward-error" role="alert">{state.error}</p>}
      {state.claimed && <p className="sr-only" role="status">{state.amount} Crowns added. Your balance is now {state.balance}.</p>}
    </section>
  );
}
