import Link from "next/link";
import Image from "next/image";
import { auth } from "@/lib/auth";
import { BrandMark } from "./brand-mark";
import { Crown } from "./crown";
import { endSession } from "@/features/auth/actions";
import { prisma } from "@/lib/prisma";
import { SiteNavigation } from "./site-navigation";
import { SiteMobileMenu } from "./site-mobile-menu";

export async function SiteHeader() {
  const session = await auth();
  const ready = Boolean(session?.user.profileCompletedAt);
  const fighter = session?.user.id ? await prisma.fighter.findUnique({ where: { userId: session.user.id }, select: { id: true, status: true } }) : null;
  const activeFighter = fighter?.status === "ACTIVE";
  const navItems = [
    { href: "/", label: "Home" },
    { href: "/live", label: "Live" },
    { href: "/fighters", label: "Fighters" },
    { href: "/cards", label: "Cards" },
    { href: "/market", label: "Market" },
    ...(session?.user.wageringEligible ? [{ href: "/casino/coin-flip", label: "Casino", match: ["/casino"] }] : []),
    ...(!fighter ? [{ href: "/become-a-fighter", label: "Become a fighter" }] : []),
    ...(activeFighter ? [{ href: "/fighter-pool", label: "Fighter Pool" }, { href: "/fight-requests", label: "Fight requests" }] : []),
    ...(session?.user.roles.some((role) => role === "ADMIN" || role === "FIGHTER_ANALYST") ? [{ href: "/admin/home", label: "Control center", match: ["/admin"] }] : []),
  ];

  return (
    <header className="site-header">
      <Link className="brand" href="/" aria-label="RFL Realm Fighting League home">
        <BrandMark />
        <span className="brand-copy"><strong>RFL</strong><small>Realm Fighting League</small></span>
      </Link>

      <SiteNavigation items={navItems} />

      <div className="header-actions">
        {session ? (
          <>
            {ready && (
              <Link className="wallet-pill" href="/play" aria-label={`${session.user.walletBalance} Crowns`}>
                <Crown /> <span>{session.user.walletBalance.toLocaleString()}</span>
              </Link>
            )}
            <Link className="avatar-link" href={ready ? "/profile" : "/welcome"} aria-label="Open your profile">
              {session.user.image ? <Image src={session.user.image} alt="" height={38} width={38} /> : <span>{session.user.name?.[0] ?? "P"}</span>}
            </Link>
            <form action={endSession} className="desktop-signout">
              <button className="text-button" type="submit">Sign out</button>
            </form>
          </>
        ) : (
          <Link className="button button-small" href="/signin">Sign in</Link>
        )}
      </div>
      <SiteMobileMenu items={navItems} />
    </header>
  );
}
