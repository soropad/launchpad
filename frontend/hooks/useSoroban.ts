"use client";

import { useCallback, useMemo } from "react";
import { useNetwork } from "../app/providers/NetworkProvider";
import * as stellar from "../lib/stellar";

/**
 * A hook that provides network-aware Soroban functions.
 * These functions automatically use the current network configuration
 * from the NetworkProvider.
 */
export function useSoroban() {
  const { networkConfig } = useNetwork();

  const fetchTokenInfo = useCallback(
    (contractId: string) => stellar.fetchTokenInfo(contractId, networkConfig),
    [networkConfig]
  );

  const fetchTopHolders = useCallback(
    (contractId: string, symbol?: string, issuer?: string, limit?: number) =>
      stellar.fetchTopHolders(contractId, networkConfig, symbol, issuer, limit),
    [networkConfig]
  );

  const fetchCurrentLedger = useCallback(
    () => stellar.fetchCurrentLedger(networkConfig),
    [networkConfig]
  );

  const fetchVestingSchedule = useCallback(
    (vestingContractId: string, recipient: string) =>
      stellar.fetchVestingSchedule(vestingContractId, recipient, networkConfig),
    [networkConfig]
  );

  return useMemo(
    () => ({
      fetchTokenInfo,
      fetchTopHolders,
      fetchCurrentLedger,
      fetchVestingSchedule,
      networkConfig,
      // Pass through formatting helpers which don't need config
      formatTokenAmount: stellar.formatTokenAmount,
      truncateAddress: stellar.truncateAddress,
    }),
    [
      fetchTokenInfo,
      fetchTopHolders,
      fetchCurrentLedger,
      fetchVestingSchedule,
      networkConfig,
    ]
  );
}
