import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <nav aria-label="Legal and support">
        <Link href="/terms">Terms and Conditions</Link>
        <Link href="/privacy">Privacy Policy</Link>
        <Link href="/responsible-play">Responsible Play</Link>
      </nav>
      <a href="mailto:PlayRflHelp@gmail.com">Contact us: PlayRflHelp@gmail.com</a>
      <small>© {new Date().getUTCFullYear()} Realm Fighting League. Crowns have no cash value.</small>
    </footer>
  );
}
