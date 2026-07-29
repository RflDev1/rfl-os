"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type NavItem = { href: string; label: string; match?: string[] };

function isActive(pathname: string, item: NavItem) {
  const matches = item.match ?? [item.href];
  return matches.some((path) => path === "/" ? pathname === "/" : pathname === path || pathname.startsWith(`${path}/`));
}

export function SiteMobileMenu({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const menuPanelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) return;

    menuPanelRef.current?.querySelector<HTMLAnchorElement>("a")?.focus();

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      menuButtonRef.current?.focus();
    };

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  return (
    <div className="site-mobile-menu">
      <button
        aria-controls="site-mobile-menu-panel"
        aria-expanded={open}
        aria-label={open ? "Close navigation menu" : "Open navigation menu"}
        className="menu-toggle"
        onClick={() => setOpen((current) => !current)}
        ref={menuButtonRef}
        type="button"
      >
        <span /><span /><span />
      </button>
      {open && (
        <nav aria-label="Mobile navigation" className="mobile-menu-panel" id="site-mobile-menu-panel" ref={menuPanelRef}>
          {items.map((item) => {
            const active = isActive(pathname, item);
            return (
              <Link aria-current={active ? "page" : undefined} className={active ? "mobile-menu-active" : undefined} href={item.href} key={item.href} onClick={() => setOpen(false)}>
                {item.label}
              </Link>
            );
          })}
        </nav>
      )}
    </div>
  );
}
