"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Crown } from "@/components/crown";
import { CollectibleCard } from "./collectible-card";
import { openPackAction } from "./cards.actions";

export function PackReveal({ packId, price, balance, openingKey }: { packId: string; price: number; balance: number; openingKey: string }) {
  const [state, action, pending] = useActionState(openPackAction, {});
  const [revealed, setRevealed] = useState(0);
  const cards = state.cards ?? [];

  if (cards.length > 0) return (
    <section className="pack-results pack-results-enter" aria-live="polite">
      <div className="pack-results-heading"><p className="eyebrow"><span /> Pack committed</p><h2>{revealed === cards.length ? "The collection grows." : "Reveal your cards."}</h2><p>Tap or click each card to reveal it.</p></div>
      <div className="reveal-grid">{cards.map((card, index) => <button aria-label={index < revealed ? `View ${card.name}` : `Reveal card ${index + 1}`} className={index < revealed ? "is-revealed" : ""} key={card.id} onClick={() => setRevealed((count) => Math.max(count, index + 1))} style={{ "--reveal-order": index } as React.CSSProperties} type="button"><CollectibleCard card={card} revealed={index < revealed} /></button>)}</div>
      <div className="reveal-actions"><button className="button button-primary" disabled={revealed === cards.length} onClick={() => setRevealed(cards.length)} type="button">Reveal all</button><Link className="button button-ghost" href="/cards">View collection</Link></div>
    </section>
  );

  if (pending) return (
    <div className="pack-opening-stage" aria-live="polite" aria-label="Opening card pack">
      <div className="pack-opening-burst" />
      <div className="pack-opening-pack"><span>REALM</span><strong>RFL</strong><small>Breaking the seal…</small></div>
    </div>
  );

  return (
    <form action={action} className="pack-purchase">
      <input name="packId" type="hidden" value={packId} />
      <input name="idempotencyKey" type="hidden" value={openingKey} />
      <div><small>Pack price</small><strong>{price.toLocaleString()} <Crown /></strong><span>Your balance: {balance.toLocaleString()}</span></div>
      <button className="button button-primary" disabled={pending || balance < price} type="submit">{pending ? "Committing cards…" : "Purchase and open"}</button>
      {state.error && <p className="game-error" role="alert">{state.error}</p>}
      <p>Results are generated and saved before the reveal begins. Duplicates are possible.</p>
    </form>
  );
}
