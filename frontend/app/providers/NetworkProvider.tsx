"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useMemo,
  type ReactNode,
} from "react";
import { type NetworkConfig, type NetworkType, NETWORKS } from "../../types/network";

interface NetworkContextValue {
  networkConfig: NetworkConfig;
  setNetwork: (network: NetworkType) => void;
  mounted: boolean;
}

const NetworkContext = createContext<NetworkContextValue | undefined>(undefined);

export function NetworkProvider({ children }: { children: ReactNode }) {
  const [network, setNetworkState] = useState<NetworkType>("testnet");
  const [mounted, setMounted] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("soropad:network") as NetworkType;
    if (saved && (saved === "testnet" || saved === "mainnet")) {
      setNetworkState(saved);
    }
    setMounted(true);
  }, []);

  const setNetwork = (n: NetworkType) => {
    setNetworkState(n);
    localStorage.setItem("soropad:network", n);
  };

  const networkConfig = useMemo(() => NETWORKS[network], [network]);

  const value = useMemo(
    () => ({
      networkConfig,
      setNetwork,
      mounted,
    }),
    [networkConfig, mounted]
  );

  return (
    <NetworkContext.Provider value={value}>{children}</NetworkContext.Provider>
  );
}

export function useNetwork() {
  const context = useContext(NetworkContext);
  if (context === undefined) {
    throw new Error("useNetwork must be used within a NetworkProvider");
  }
  return context;
}
