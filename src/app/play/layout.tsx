import type { ReactNode } from "react";
import { FightRequestStatus } from "@/features/fight-requests/request-status";

export default function PlayLayout({ children }: { children: ReactNode }) {
  return <>{children}<FightRequestStatus /></>;
}
