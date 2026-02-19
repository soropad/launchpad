import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SoroPad — Soroban Token Launchpad",
  description:
    "Deploy and manage SEP-41 compliant tokens on Stellar Soroban. No code required.",
  openGraph: {
    title: "SoroPad — Soroban Token Launchpad",
    description:
      "Deploy and manage SEP-41 compliant tokens on Stellar Soroban. No code required.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen`}
      >
        {/* ── Navbar ──────────────────────────────────────────── */}
        <nav className="fixed top-0 z-50 w-full border-b border-white/5 bg-void-900/80 backdrop-blur-lg">
          <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
            {/* Logo */}
            <Link
              href="/"
              className="flex items-center gap-2 text-lg font-bold"
            >
              <span className="text-2xl">🚀</span>
              <span className="gradient-text">SoroPad</span>
            </Link>

            {/* Nav links */}
            <div className="hidden items-center gap-6 md:flex">
              <Link
                href="/deploy"
                className="text-sm text-gray-400 transition-colors hover:text-white"
              >
                Deploy
              </Link>
              <Link
                href="/dashboard"
                className="text-sm text-gray-400 transition-colors hover:text-white"
              >
                Dashboard
              </Link>
            </div>

            {/* Right side — placeholders for wallet (#8) & network (#12) */}
            <div className="flex items-center gap-3">
              {/* TODO (issue #12): network switcher component */}
              <div className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-gray-500">
                Testnet
              </div>

              {/* TODO (issue #8): wallet connect button component */}
              <button className="btn-primary text-sm">Connect Wallet</button>
            </div>
          </div>
        </nav>

        {/* Page content offset for fixed nav */}
        <main className="pt-16">{children}</main>

        {/* ── Footer ─────────────────────────────────────────── */}
        <footer className="border-t border-white/5 py-8 text-center text-sm text-gray-500">
          <p>
            Built for the{" "}
            <a
              href="https://www.drips.network/wave"
              className="text-stellar-400 hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              Stellar Wave Program
            </a>{" "}
            · MIT License
          </p>
        </footer>
      </body>
    </html>
  );
}
