import type { ReactNode } from "react";
import Link from "next/link";
import { requireAdmin } from "@/features/admin/authorization";
import { BrandMark } from "@/components/brand-mark";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireAdmin();
  return (
    <div className="admin-shell">
      <header className="admin-header">
        <Link className="brand" href="/admin"><BrandMark /><span className="brand-copy"><strong>RFL</strong><small>Control center</small></span></Link>
        <nav aria-label="Admin"><Link href="/admin">Today</Link><Link href="/admin/home">Content</Link><Link href="/admin/live">Events</Link><Link href="/admin/rankings">Rankings</Link><Link href="/admin/betting">Betting</Link><Link href="/admin/cards">Cards</Link><Link href="/admin/marketplace">Market</Link><Link href="/admin/requests">Requests</Link><Link href="/admin/economy">Economy</Link><Link href="/admin/users">Users</Link><Link href="/admin/audit">Audit</Link><Link href="/admin/settings">Settings</Link></nav>
        <Link className="text-button" href="/">Return to player site →</Link>
      </header>
      {children}
    </div>
  );
}
