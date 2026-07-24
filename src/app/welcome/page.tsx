import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { BrandMark } from "@/components/brand-mark";
import { ProfileForm } from "@/features/auth/profile-form";

export const metadata: Metadata = { title: "Choose your player name" };

export default async function WelcomePage() {
  const session = await auth();
  if (!session) redirect("/signin");
  if (session.user.status !== "ACTIVE") redirect("/signin?error=AccessDenied");
  if (session.user.profileCompletedAt) redirect("/play");

  return (
    <main className="auth-page">
      <div className="auth-ambient" aria-hidden="true" />
      <div className="auth-brand"><BrandMark /></div>
      <section className="auth-card profile-card" aria-labelledby="welcome-title">
        <p className="step-label">Final step</p>
        <h1 id="welcome-title">Choose your player name.</h1>
        <p>Make it yours. You can change it later.</p>
        <ProfileForm suggestedName={session.user.name ?? "Player"} />
      </section>
    </main>
  );
}

