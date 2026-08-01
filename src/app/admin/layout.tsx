import type { ReactNode } from "react";
import Link from "next/link";
import { requireControlCenter } from "@/features/admin/authorization";
import { BrandMark } from "@/components/brand-mark";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await requireControlCenter();
  const isAdmin = session.user.roles.includes("ADMIN");
  return (
    <div className="admin-shell">
      <header className="admin-header">
        <Link className="brand" href="/admin"><BrandMark /><span className="brand-copy"><strong>RFL</strong><small>Control center</small></span></Link>
        <nav aria-label="Admin">
          {isAdmin && <Link href="/admin">Today</Link>}
          <Link href="/admin/home">Content</Link>
          <Link href="/admin/live">Events</Link>
          <Link href="/admin/rankings">Rankings</Link>
          <Link href="/admin/betting">Fight betting</Link>
          {isAdmin && <Link href="/admin/cards">Cards</Link>}
          {isAdmin && <Link href="/admin/marketplace">Market</Link>}
          <Link href="/admin/requests">Fight requests</Link>
          {isAdmin && <Link href="/admin/fighter-pool">Fighter Pool</Link>}
          {isAdmin && <Link href="/admin/economy">Economy</Link>}
          {isAdmin && <Link href="/admin/users">Users</Link>}
          {isAdmin && <Link href="/admin/audit">Audit</Link>}
          {isAdmin && <Link href="/admin/settings">Settings</Link>}
        </nav>
        <Link className="text-button" href="/">Return to player site →</Link>
      </header>
      {children}
    </div>
  );
}
