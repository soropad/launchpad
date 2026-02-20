"use client";

import Link from "next/link";
import { WalletButton } from "./WalletButton";

/**
 * Top navbar — extracted as a client component so wallet state
 * (via `useWallet` inside `<WalletButton>`) works with React hooks.
 */
export function Navbar() {
  return (
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

        {/* Right side — wallet & network */}
        <div className="flex items-center gap-3">
          {/* TODO (issue #12): network switcher component */}
          <div className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-gray-500">
            Testnet
          </div>

          {/* Wallet connect / disconnect */}
          <WalletButton />
        </div>
      </div>
    </nav>
  );
}
