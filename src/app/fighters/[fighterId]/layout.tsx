import type { ReactNode } from "react";
import { FighterRequestPanel } from "@/features/fight-requests/fighter-request-panel";

export default async function FighterLayout({ children, params }: { children: ReactNode; params: Promise<{ fighterId: string }> }) {
  const { fighterId } = await params;
  return <>{children}<FighterRequestPanel opponentFighterId={fighterId} /></>;
}
