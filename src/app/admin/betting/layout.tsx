import type { ReactNode } from "react";
import { AdminSectionGuard } from "@/components/admin-section-guard";
export default function Layout({ children }: { children: ReactNode }) { return <AdminSectionGuard section="BETTING">{children}</AdminSectionGuard>; }
