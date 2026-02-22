import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { WalletProvider } from "./providers/WalletProvider";
import { NetworkProvider } from "./providers/NetworkProvider";
import { Navbar } from "./components/Navbar";
import { MainnetWarning } from "./components/MainnetWarning";

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
        <NetworkProvider>
          <WalletProvider>
            {/* ── Navbar ──────────────────────────────────────────── */}
            <Navbar />

            {/* Mainnet Warning Banner */}
            <MainnetWarning />

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
          </WalletProvider>
        </NetworkProvider>
      </body>
    </html>
  );
}
