"use client";

import { useActionState, useId, useMemo, useState } from "react";
import { Crown } from "@/components/crown";
import { oddsLabel } from "./betting.logic";
import { placeBetAction } from "./betting.actions";

export function BetSlip({ marketId, redName, blueName, redOddsBps, blueOddsBps, minStake, maxStake, balance }: { marketId: string; redName: string; blueName: string; redOddsBps: number; blueOddsBps: number; minStake: number; maxStake: number; balance: number }) {
  const [state, action, pending] = useActionState(placeBetAction, {});
  const [selection, setSelection] = useState<"RED" | "BLUE">("RED");
  const [stake, setStake] = useState(String(minStake));
  const actionId = useId();
  const idempotencyKey = `${marketId}:${actionId}`;
  const odds = selection === "RED" ? redOddsBps : blueOddsBps;
  const possible = useMemo(() => Math.floor(Number(stake || 0) * odds / 10_000), [stake, odds]);
  const currentBalance = state.balance ?? balance;
  return <form action={action} className="fight-bet-slip"><input name="marketId" type="hidden" value={marketId} /><input name="idempotencyKey" type="hidden" value={idempotencyKey} /><div className="bet-picks"><label className={selection === "RED" ? "selected red" : "red"}><input checked={selection === "RED"} name="selection" onChange={() => setSelection("RED")} type="radio" value="RED" /><span>{redName}</span><strong>{oddsLabel(redOddsBps)}</strong></label><label className={selection === "BLUE" ? "selected blue" : "blue"}><input checked={selection === "BLUE"} name="selection" onChange={() => setSelection("BLUE")} type="radio" value="BLUE" /><span>{blueName}</span><strong>{oddsLabel(blueOddsBps)}</strong></label></div><div className="bet-review"><label>Bet amount<span><Crown /><input max={maxStake} min={minStake} name="stake" onChange={(event) => setStake(event.target.value)} step="1" type="number" value={stake} /></span></label><p><small>Possible return</small><strong>{possible.toLocaleString()} <Crown /></strong></p><button className="button button-primary" disabled={!idempotencyKey || pending || Number(stake) > currentBalance} type="submit">{pending ? "Confirming…" : "Confirm bet"}</button></div>{state.error && <p className="game-error" role="alert">{state.error}</p>}{state.success && <p className="bet-success" role="status">{state.success}</p>}<small className="bet-disclaimer">Accepted odds are fixed. Crowns have no cash value.</small></form>;
}
