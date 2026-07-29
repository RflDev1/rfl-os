import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { getEnv } from "@/lib/env";

export const metadata: Metadata = {
  title: "Become a Fighter",
  description: "Apply to join the official Realm Fighting League fighter roster.",
};

function DiscordMark() {
  return <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M19.5 5.3A17 17 0 0 0 15.4 4l-.5 1.1a15.7 15.7 0 0 0-5.8 0L8.6 4a17 17 0 0 0-4.1 1.3C1.9 9.2 1.2 13 1.6 16.7a16.5 16.5 0 0 0 5 2.5l1.2-1.7-1.7-.8.4-.3c3.5 1.6 7.4 1.6 10.9 0l.5.3-1.8.8 1.2 1.7a16.5 16.5 0 0 0 5-2.5c.5-4.3-.8-8-2.8-11.4ZM8.4 14.5c-1.1 0-2-1-2-2.3s.9-2.3 2-2.3 2 1 2 2.3-.9 2.3-2 2.3Zm7.2 0c-1.1 0-2-1-2-2.3s.9-2.3 2-2.3 2 1 2 2.3-.9 2.3-2 2.3Z" /></svg>;
}

export default function BecomeAFighterPage() {
  const discordUrl = getEnv().BECOME_FIGHTER_DISCORD_URL;
  return <main className="fighter-application-page">
    <SiteHeader />
    <section className="fighter-application-card">
      <p className="eyebrow"><span /> Join the official roster</p>
      <h1>Become an RFL fighter.</h1>
      <p>Ready to compete? Open a private application ticket in the official RFL Discord. Our staff will guide you through the application and answer your questions.</p>
      {discordUrl
        ? <a className="discord-pill" href={discordUrl} rel="noreferrer" target="_blank"><DiscordMark /><span>Open a fighter application</span><b>↗</b></a>
        : <span className="discord-pill discord-pill-disabled">Applications temporarily unavailable</span>}
      <small>You must be signed in to Discord and a member of the official RFL server.</small>
    </section>
  </main>;
}
