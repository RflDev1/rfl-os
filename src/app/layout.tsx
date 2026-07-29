import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SiteFooter } from "@/components/site-footer";

export const metadata: Metadata = {
  title: { default: "Realm Fighting League", template: "%s · RFL" },
  description: "Watch fights, compete, and build your legacy in Realm Fighting League.",
  icons: { icon: "/rfl-logo.png", apple: "/rfl-logo.png" },
};

export const viewport: Viewport = { colorScheme: "dark", themeColor: "#080a0f" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main-content">Skip to main content</a>
        <div id="main-content" tabIndex={-1}>{children}</div>
        <SiteFooter />
      </body>
    </html>
  );
}
