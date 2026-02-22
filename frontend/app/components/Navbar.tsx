"use client";

import Link from "next/link";
import { useNetwork } from "../providers/NetworkProvider";
import { WalletButton } from "./WalletButton";
import { Globe, ChevronDown } from "lucide-react";
import { useState } from "react";

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
          <NetworkSwitcher />

          {/* Wallet connect / disconnect */}
          <WalletButton />
        </div>
      </div>
    </nav>
  );
}
function NetworkSwitcher() {
  const { networkConfig, setNetwork, mounted } = useNetwork();
  const [isOpen, setIsOpen] = useState(false);

  if (!mounted) {
    return (
      <div className="h-8 w-24 animate-pulse rounded-lg border border-white/5 bg-white/5" />
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-gray-300 transition-colors hover:bg-white/10"
      >
        <Globe className="size-3.5 text-stellar-400" />
        <span className="capitalize">{networkConfig.network}</span>
        <ChevronDown className="size-3 text-gray-500" />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 mt-2 w-32 origin-top-right rounded-xl border border-white/10 bg-void-800 p-1 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-100">
            <button
              onClick={() => {
                setNetwork("testnet");
                setIsOpen(false);
              }}
              className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition-colors ${
                networkConfig.network === "testnet"
                  ? "bg-stellar-500/10 text-stellar-400"
                  : "text-gray-400 hover:bg-white/5 hover:text-white"
              }`}
            >
              Testnet
            </button>
            <button
              onClick={() => {
                setNetwork("mainnet");
                setIsOpen(false);
              }}
              className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition-colors ${
                networkConfig.network === "mainnet"
                  ? "bg-amber-500/10 text-amber-500"
                  : "text-gray-400 hover:bg-white/5 hover:text-white"
              }`}
            >
              Mainnet
            </button>
          </div>
        </>
      )}
    </div>
  );
}
