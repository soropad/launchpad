"use client";

import { useContext } from "react";
import { WalletContext, type WalletContextValue } from "../providers/WalletProvider";

/**
 * Access the Freighter wallet state and actions.
 *
 * Must be used inside a `<WalletProvider>`.
 *
 * @example
 * ```tsx
 * const { connected, publicKey, connect, disconnect, signTransaction } = useWallet();
 * ```
 */
export function useWallet(): WalletContextValue {
  const ctx = useContext(WalletContext);

  if (ctx === undefined) {
    throw new Error("useWallet must be used within a <WalletProvider>");
  }

  return ctx;
}
