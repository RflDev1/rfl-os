import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { BrandMark } from "@/components/brand-mark";
import { beginDiscordSignIn } from "@/features/auth/actions";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await auth();
  if (session) redirect(session.user.profileCompletedAt ? "/play" : "/welcome");
  const { error } = await searchParams;

  return (
    <main className="auth-page">
      <div className="auth-ambient" aria-hidden="true" />
      <Link className="auth-brand" href="/" aria-label="RFL home"><BrandMark /></Link>
      <section className="auth-card" aria-labelledby="signin-title">
        <p className="eyebrow centered"><span /> Welcome to the realm <span /></p>
        <h1 id="signin-title">Your corner awaits.</h1>
        <p>One secure Discord login is all you need to begin.</p>
        {error && (
          <p className="auth-error" role="alert">
            We couldn’t sign you in. Your account may be unavailable, or Discord may have cancelled the request.
          </p>
        )}
        <form action={beginDiscordSignIn}>
          <button className="button discord-button button-wide" type="submit">
            <span className="discord-icon" aria-hidden="true">☁</span>
            Continue with Discord
          </button>
        </form>
        <div className="secure-note"><span aria-hidden="true">◇</span><p><strong>Secure by design</strong><br />We only ask Discord for your basic identity.</p></div>
        <p className="terms">By continuing, you agree to the RFL player rules and privacy notice.</p>
      </section>
      <Link className="back-link" href="/">← Back to RFL</Link>
    </main>
  );
}

