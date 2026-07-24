import type { ReactNode } from "react";
import { EventBetting } from "@/features/betting/event-betting";

export default async function LiveEventLayout({ children, params }: { children: ReactNode; params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  return <>{children}<EventBetting eventId={eventId} /></>;
}
