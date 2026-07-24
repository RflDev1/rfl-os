"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Crown } from "@/components/crown";
import { buyListingAction } from "./marketplace.actions";

export function BuyPanel({ listingId, price, balance, purchaseKey }: { listingId: string; price: number; balance: number; purchaseKey: string }) {
  const [state, action, pending] = useActionState(buyListingAction, {});
  if (state.success) return <div className="purchase-complete"><strong>{state.success}</strong><Link className="button button-primary" href="/cards">View collection</Link></div>;
  return <form action={action} className="buy-panel"><input name="listingId" type="hidden" value={listingId} /><input name="idempotencyKey" type="hidden" value={purchaseKey} /><div><small>Total</small><strong>{price.toLocaleString()} <Crown /></strong><span>Marketplace fee: 0 Crowns</span></div><button className="button button-primary" disabled={pending || balance < price}>{pending ? "Transferring…" : "Confirm purchase"}</button>{state.error && <p className="game-error">{state.error}</p>}<p>The card and Crowns transfer together. All card sales are final.</p></form>;
}
