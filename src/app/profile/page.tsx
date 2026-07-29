import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { Crown } from "@/components/crown";
import { FightRequestStatus } from "@/features/fight-requests/request-status";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Your profile" };

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user.id) redirect("/signin");
  if (!session.user.profileCompletedAt) redirect("/welcome");
  if (!session.user.legalOnboardingComplete) redirect("/welcome");
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { wallet: true, fighterProfile: true, roles: true, accounts: { where: { provider: "discord" }, select: { providerAccountId: true } } },
  });
  if (!user) redirect("/signin");
  const isAdmin = user.roles.some(({ role }) => role === "ADMIN");

  return <main className="profile-page"><SiteHeader /><section className="profile-hero"><div className="profile-avatar">{user.image ? <Image alt="" height={132} priority src={user.image} width={132} /> : <span>{(user.displayName ?? user.name ?? "P")[0]}</span>}</div><div><p className="eyebrow"><span /> RFL account</p><h1>{user.displayName ?? user.name ?? "Player"}</h1><p>{user.fighterProfile ? `Official fighter · Rank #${user.fighterProfile.rank ?? "Unranked"}` : "Realm Fighting League member"}</p><div className="profile-actions"><Link className="button button-ghost" href="/play">Your corner</Link>{user.fighterProfile && <Link className="button button-ghost" href={`/fighters/${user.fighterProfile.id}`}>Fighter profile</Link>}{isAdmin && <Link className="button button-primary" href="/admin">Control Panel</Link>}</div></div></section><section className="profile-overview"><article><span>Crown balance</span><strong><Crown /> {(user.wallet?.balance ?? 0).toLocaleString()}</strong><small>Virtual in-platform currency</small></article><article><span>Account status</span><strong>{user.status}</strong><small>Discord account connected</small></article><article><span>Betting access</span><strong>{session.user.wageringEligible ? "18+ unlocked" : "Locked"}</strong><small>Your birthday remains private</small></article><article><span>Roles</span><strong>{user.roles.map(({ role }) => role).join(" · ") || "PLAYER"}</strong><small>{isAdmin ? "League operations access enabled" : "Player access"}</small></article>{user.fighterProfile && <article><span>Official record</span><strong>{user.fighterProfile.wins}-{user.fighterProfile.losses}-{user.fighterProfile.draws}</strong><small>{user.fighterProfile.name}</small></article>}</section>{user.fighterProfile && <FightRequestStatus />}</main>;
}
