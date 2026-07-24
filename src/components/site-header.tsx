import Link from "next/link";
import Image from "next/image";
import { auth } from "@/lib/auth";
import { BrandMark } from "./brand-mark";
import { Crown } from "./crown";
import { endSession } from "@/features/auth/actions";
import { prisma } from "@/lib/prisma";

export async function SiteHeader() {
  const session = await auth();
  const ready = Boolean(session?.user.profileCompletedAt);
  const fighter = session?.user.id ? await prisma.fighter.findUnique({ where: { userId: session.user.id }, select: { id: true } }) : null;

  return (
    <header className="site-header">
      <Link className="brand" href="/" aria-label="Realm Fighting League home">
        <BrandMark />
        <span className="brand-copy"><strong>RFL</strong><small>Realm Fighting League</small></span>
      </Link>

      <nav className="main-nav" aria-label="Primary navigation">
        <Link className="nav-link nav-link-active" href="/">Home</Link>
        <Link className="nav-link" href="/live">Live</Link>
        <Link className="nav-link" href="/fighters">Fighters</Link>
        <Link className="nav-link" href="/cards">Cards</Link>
        <Link className="nav-link" href="/market">Market</Link>
        {session?.user.profileCompletedAt && <Link className="nav-link" href="/casino/coin-flip">Casino</Link>}
        {fighter && <Link className="nav-link" href="/fight-requests">Fight requests</Link>}
        {session?.user.roles.includes("ADMIN") && <Link className="nav-link" href="/admin/home">Control center</Link>}
      </nav>

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
      <nav className="mobile-bottom-nav" aria-label="Mobile navigation">
        <Link href="/">Home</Link><Link href="/live">Live</Link><Link href="/fighters">Fighters</Link>{fighter ? <Link href="/fight-requests">Requests</Link> : <Link href="/casino/coin-flip">Casino</Link>}<Link href="/cards">Cards</Link><Link href="/market">Market</Link>
      </nav>
    </header>
  );
}
