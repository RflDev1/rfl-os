import type { ReactNode } from "react";
import { AdminOnlyGuard } from "@/components/admin-section-guard";
export default function Layout({ children }: { children: ReactNode }) { return <AdminOnlyGuard>{children}</AdminOnlyGuard>; }
