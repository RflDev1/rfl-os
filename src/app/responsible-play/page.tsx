import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = { title: "Responsible Play" };

export default function ResponsiblePlayPage() {
  return (
    <LegalPage eyebrow="Player protection" title="Responsible Play Policy">
      <section><h2>Virtual play only</h2><p>Coin Flip, Blackjack, High-Low, and fight betting use Crowns only. Crowns have no cash value, cannot be purchased for cash on the current service, and cannot be redeemed. These activities are entertainment features, not a way to earn money.</p></section>
      <section><h2>Age restriction</h2><p>These features are restricted to users who report that they are at least 18. RFL saves the submitted birth date and enforces the restriction in navigation, pages, and server-side wager actions. Providing false age information violates the Terms.</p></section>
      <section><h2>Play responsibly</h2><p>Set personal limits, take breaks, and do not chase losses. Stop if play causes distress or interferes with daily life. RFL may apply configured wager and rate limits, void abusive activity, restrict features, or suspend accounts. Self-service spending limits and self-exclusion controls are not currently implemented; contact RFL to request manual assistance.</p></section>
    </LegalPage>
  );
}
