import Link from "next/link";
import { SiteHeader } from "./site-header";

export function LegalPage({ eyebrow, title, children }: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <main className="legal-page">
      <SiteHeader />
      <article>
        <p className="eyebrow"><span /> {eyebrow}</p>
        <h1>{title}</h1>
        <p className="legal-version">Effective July 29, 2026 · Version 1.0-draft</p>
        {children}
        <p>Questions may be sent to <a href="mailto:PlayRflHelp@gmail.com">PlayRflHelp@gmail.com</a>.</p>
        <p><Link href="/">Return to RFL</Link></p>
      </article>
    </main>
  );
}
