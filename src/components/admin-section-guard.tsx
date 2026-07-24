import type { ReactNode } from "react";
import { requireAdmin, requireAdminSection } from "@/features/admin/authorization";
import type { AdminSection } from "@/features/admin/authorization.logic";

export async function AdminSectionGuard({ children, section }: { children: ReactNode; section: AdminSection }) {
  await requireAdminSection(section);
  return children;
}

export async function AdminOnlyGuard({ children }: { children: ReactNode }) {
  await requireAdmin();
  return children;
}
