"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = { href: string; label: string; match?: string[] };

function isActive(pathname: string, item: NavItem) {
  const matches = item.match ?? [item.href];
  return matches.some((path) => path === "/" ? pathname === "/" : pathname === path || pathname.startsWith(`${path}/`));
}

export function SiteNavigation({ items, mobile = false }: { items: NavItem[]; mobile?: boolean }) {
  const pathname = usePathname();

  return (
    <nav className={mobile ? "mobile-bottom-nav" : "main-nav"} aria-label={mobile ? "Mobile navigation" : "Primary navigation"}>
      {items.map((item) => (
        <Link
          aria-current={isActive(pathname, item) ? "page" : undefined}
          className={isActive(pathname, item) ? (mobile ? "mobile-nav-active" : "nav-link nav-link-active") : (mobile ? undefined : "nav-link")}
          href={item.href}
          key={item.href}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
