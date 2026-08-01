import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getFighterPoolState } from "@/features/fighter-pool/fighter-pool.service";
import { FighterPoolPanel } from "@/features/fighter-pool/fighter-pool-panel";

export const metadata: Metadata = { title: "Fighter Pool" };
export default async function FighterPoolPage({ searchParams }: { searchParams: Promise<{ notice?: string; error?: string }> }) {
  const session = await auth(); if (!session) redirect("/signin");
  const [state, query] = await Promise.all([getFighterPoolState(session.user.id), searchParams]);
  return <main className="pool-page"><header><p className="eyebrow"><span /> Ranked BedWars on demand</p><h1>Fighter Pool</h1><p>Enter the queue, meet an eligible fighter within five ranks, and play an official best-of-three BedWars fight.</p></header>{query.notice && <p className="admin-notice" role="status">{query.notice}</p>}{query.error && <p className="admin-error" role="alert">{query.error}</p>}<FighterPoolPanel initialState={JSON.parse(JSON.stringify(state))} /></main>;
}
