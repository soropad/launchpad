"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { Copy, Check, ArrowUpDown, AlertCircle, Loader2 } from "lucide-react";
import {
  fetchTokenInfo,
  fetchTopHolders,
  fetchSupplyBreakdown,
  truncateAddress,
  type TokenInfo,
  type TokenHolder,
  type SupplyBreakdown,
} from "@/lib/stellar";
import VestingProgress from "./VestingProgress";
import SupplyBreakdownChart from "@/components/charts/SupplyBreakdownChart";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type SortField = "address" | "balance" | "sharePercent";
type SortDir = "asc" | "desc";

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API may be unavailable (e.g. non-HTTPS)
    }
  }, [text]);

  return (
    <button
      onClick={handleCopy}
      className="ml-2 inline-flex items-center rounded-md border border-white/10 px-2 py-1 text-xs text-gray-400 transition-colors hover:border-stellar-400/30 hover:text-stellar-300"
      aria-label={copied ? "Copied" : "Copy to clipboard"}
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-green-400" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
    </button>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass-card flex flex-col gap-1 p-4">
      <span className="text-xs font-medium uppercase tracking-wider text-gray-500">
        {label}
      </span>
      <span className="truncate text-lg font-semibold text-white">{value}</span>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
      <Loader2 className="h-8 w-8 animate-spin text-stellar-400" />
      <p className="text-sm text-gray-400">Fetching token data...</p>
    </div>
  );
}

function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <AlertCircle className="h-10 w-10 text-red-400" />
      <p className="max-w-md text-gray-400">{message}</p>
      <button onClick={onRetry} className="btn-secondary px-4 py-2 text-sm">
        Retry
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Holders table
// ---------------------------------------------------------------------------

function HoldersTable({ holders }: { holders: TokenHolder[] }) {
  const [sortField, setSortField] = useState<SortField>("balance");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  const sorted = useMemo(() => {
    return [...holders].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "address":
          cmp = a.address.localeCompare(b.address);
          break;
        case "balance":
          cmp = parseFloat(a.balance) - parseFloat(b.balance);
          break;
        case "sharePercent":
          cmp = a.sharePercent - b.sharePercent;
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [holders, sortField, sortDir]);

  if (holders.length === 0) {
    return (
      <div className="glass-card p-8 text-center text-gray-500">
        <p>No holder data available.</p>
        <p className="mt-1 text-xs">
          Soroban-native tokens require an indexer for full holder enumeration.
        </p>
      </div>
    );
  }

  const thClass =
    "px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 cursor-pointer select-none hover:text-gray-300 transition-colors";

  return (
    <div className="glass-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm" role="table">
          <thead>
            <tr className="border-b border-white/5">
              <th
                className={thClass}
                onClick={() => toggleSort("address")}
                aria-sort={
                  sortField === "address"
                    ? sortDir === "asc"
                      ? "ascending"
                      : "descending"
                    : "none"
                }
              >
                <span className="inline-flex items-center gap-1">
                  Address
                  <ArrowUpDown className="h-3 w-3" />
                </span>
              </th>
              <th
                className={`${thClass} text-right`}
                onClick={() => toggleSort("balance")}
                aria-sort={
                  sortField === "balance"
                    ? sortDir === "asc"
                      ? "ascending"
                      : "descending"
                    : "none"
                }
              >
                <span className="inline-flex items-center justify-end gap-1">
                  Balance
                  <ArrowUpDown className="h-3 w-3" />
                </span>
              </th>
              <th
                className={`${thClass} text-right`}
                onClick={() => toggleSort("sharePercent")}
                aria-sort={
                  sortField === "sharePercent"
                    ? sortDir === "asc"
                      ? "ascending"
                      : "descending"
                    : "none"
                }
              >
                <span className="inline-flex items-center justify-end gap-1">
                  % Share
                  <ArrowUpDown className="h-3 w-3" />
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((holder, i) => (
              <tr
                key={holder.address}
                className={`border-b border-white/5 transition-colors hover:bg-white/[0.02] ${
                  i % 2 === 0 ? "bg-white/[0.01]" : ""
                }`}
              >
                <td className="px-4 py-3 font-mono text-xs text-stellar-300">
                  <span className="hidden sm:inline">{holder.address}</span>
                  <span className="sm:hidden">
                    {truncateAddress(holder.address, 6)}
                  </span>
                  <CopyButton text={holder.address} />
                </td>
                <td className="px-4 py-3 text-right font-mono text-white">
                  {holder.balance}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <div className="hidden h-1.5 w-16 overflow-hidden rounded-full bg-void-700 sm:block">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-stellar-500 to-stellar-400"
                        style={{
                          width: `${Math.min(holder.sharePercent, 100)}%`,
                        }}
                      />
                    </div>
                    <span className="font-mono text-gray-300">
                      {holder.sharePercent.toFixed(2)}%
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main dashboard component
// ---------------------------------------------------------------------------

export default function TokenDashboard({ contractId }: { contractId: string }) {
  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);
  const [holders, setHolders] = useState<TokenHolder[]>([]);
  const [supplyBreakdown, setSupplyBreakdown] =
    useState<SupplyBreakdown | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const info = await fetchTokenInfo(contractId);
      setTokenInfo(info);

      // Attempt to load holders (best-effort for classic-wrapped assets)
      const holderData = await fetchTopHolders(contractId);
      setHolders(holderData);

      // Fetch supply breakdown
      const breakdown = await fetchSupplyBreakdown(contractId);
      setSupplyBreakdown(breakdown);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to fetch token data. Please check the contract ID and try again.",
      );
    } finally {
      setLoading(false);
    }
  }, [contractId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={loadData} />;
  if (!tokenInfo) return null;

  return (
    <div className="mx-auto max-w-5xl px-6 py-10 animate-fade-in-up">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">
          {tokenInfo.name}{" "}
          <span className="text-stellar-400">({tokenInfo.symbol})</span>
        </h1>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-gray-400">
          <span className="font-mono text-xs">
            <span className="hidden md:inline">{contractId}</span>
            <span className="md:hidden">{truncateAddress(contractId, 8)}</span>
          </span>
          <CopyButton text={contractId} />
        </div>
      </div>

      {/* Token info grid */}
      <section aria-label="Token details" className="mb-10">
        <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-gray-500">
          Token Details
        </h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <InfoCard label="Name" value={tokenInfo.name} />
          <InfoCard label="Symbol" value={tokenInfo.symbol} />
          <InfoCard label="Decimals" value={String(tokenInfo.decimals)} />
          <InfoCard label="Total Supply" value={tokenInfo.totalSupply} />
          <InfoCard label="Circulating" value={tokenInfo.circulatingSupply} />
          <InfoCard label="Admin" value={truncateAddress(tokenInfo.admin)} />
        </div>
      </section>

      {/* Supply Breakdown Chart */}
      {supplyBreakdown && (
        <section aria-label="Supply breakdown" className="mb-10">
          <SupplyBreakdownChart
            data={{
              circulating: supplyBreakdown.circulating,
              locked: supplyBreakdown.locked,
              burned: supplyBreakdown.burned,
              total: supplyBreakdown.total,
            }}
            symbol={tokenInfo.symbol}
            decimals={tokenInfo.decimals}
          />
        </section>
      )}

      {/* Top holders */}
      <section aria-label="Top holders">
        <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-gray-500">
          Top Holders
        </h2>
        <HoldersTable holders={holders} />
      </section>

      {/* Vesting schedule */}
      <section aria-label="Vesting schedule" className="mt-10">
        <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-gray-500">
          Vesting Schedule
        </h2>
        <VestingProgress decimals={tokenInfo.decimals} />
      </section>
    </div>
  );
}
