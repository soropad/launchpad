"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import {
  ArrowUpDown,
  AlertCircle,
  Loader2,
  Download,
} from "lucide-react";
import {
  truncateAddress,
  type TokenInfo,
  type TokenHolder,
  type SupplyBreakdown,
} from "@/lib/stellar";
import { useSoroban } from "@/hooks/useSoroban";
import VestingProgress from "./VestingProgress";
import TransactionHistory from "./TransactionHistory";
import { CopyButton } from "@/components/ui/CopyButton";
import SupplyBreakdownChart from "@/components/charts/SupplyBreakdownChart";
import { ExplorerLink } from "@/components/ui/ExplorerLink";
import ActivityFeed from "./ActivityFeed";
import { TransferPanel } from "./components/TransferPanel";
import { UserPanel } from "./components/UserPanel";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type SortField = "address" | "balance" | "sharePercent";
type SortDir = "asc" | "desc";

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function InfoCard({
  label,
  value,
  copyValue,
  isAddress,
}: {
  label: string;
  value: string;
  copyValue?: string;
  isAddress?: boolean;
}) {
  return (
    <div className="glass-card flex flex-col gap-1 p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-gray-500">
          {label}
        </span>
        {!isAddress && copyValue && copyValue !== "N/A" && (
          <CopyButton
            label={`Copy ${label}`}
            value={copyValue}
            className="ml-1"
          />
        )}
      </div>
      {isAddress && copyValue && copyValue !== "N/A" ? (
        <ExplorerLink
          type="account"
          identifier={copyValue}
          truncate={true}
          truncateChars={4}
          showCopy={false}
          className="text-lg font-semibold"
        />
      ) : (
        <span className="truncate text-lg font-semibold text-white">
          {value}
        </span>
      )}
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
// CSV export
// ---------------------------------------------------------------------------

function exportHoldersCsv(holders: TokenHolder[]) {
  const header = "Address,Balance,Share %";
  const rows = holders.map(
    (h) => `${h.address},${h.balance},${h.sharePercent.toFixed(2)}`,
  );
  const csv = [header, ...rows].join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "top_holders.csv";
  link.click();
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Holders table
// ---------------------------------------------------------------------------

function HoldersTable({ holders }: { holders: TokenHolder[] }) {
  const [sortField, setSortField] = useState<SortField>("balance");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
    setCurrentPage(1); // Reset to first page when sorting changes
  };

  // Filter holders based on search query
  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return holders;
    const query = searchQuery.toLowerCase();
    return holders.filter((holder) =>
      holder.address.toLowerCase().includes(query),
    );
  }, [holders, searchQuery]);

  // Sort filtered holders
  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
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
  }, [filtered, sortField, sortDir]);

  // Calculate pagination
  const totalPages = Math.ceil(sorted.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedHolders = sorted.slice(startIndex, endIndex);

  // Reset to page 1 when search changes
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCurrentPage(1);
  }, [searchQuery]);

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
    <div className="space-y-4">
      {/* Search bar */}
      <div className="glass-card p-4">
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by wallet address..."
            className="w-full rounded-lg border border-white/10 bg-void-800 px-4 py-2 pl-10 text-sm text-white placeholder-gray-500 outline-none focus:border-stellar-500 focus:ring-1 focus:ring-stellar-500"
            aria-label="Search holders by address"
          />
          <svg
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>
        {searchQuery && (
          <p className="mt-2 text-xs text-gray-400">
            Found {filtered.length} of {holders.length} holders
          </p>
        )}
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <p>No holders found matching &quot;{searchQuery}&quot;</p>
          </div>
        ) : (
          <>
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
                  {paginatedHolders.map((holder, i) => (
                    <tr
                      key={holder.address}
                      className={`border-b border-white/5 transition-colors hover:bg-white/2 ${
                        i % 2 === 0 ? "bg-white/1" : ""
                      }`}
                    >
                      <td className="px-4 py-3 font-mono text-xs text-stellar-300">
                        <ExplorerLink
                          type="account"
                          identifier={holder.address}
                          truncate={true}
                          truncateChars={6}
                          showCopy={true}
                        />
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-white">
                        {holder.balance}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="hidden h-1.5 w-16 overflow-hidden rounded-full bg-void-700 sm:block">
                            <div
                              className="h-full rounded-full bg-linear-to-r from-stellar-500 to-stellar-400"
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

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-white/5 px-4 py-3">
                <div className="text-xs text-gray-400">
                  Showing {startIndex + 1}-{Math.min(endIndex, sorted.length)}{" "}
                  of {sorted.length} holders
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-gray-300 transition-colors hover:border-stellar-400/30 hover:bg-stellar-500/10 hover:text-stellar-300 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-white/10 disabled:hover:bg-white/5 disabled:hover:text-gray-300"
                    aria-label="Previous page"
                  >
                    Previous
                  </button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter((page) => {
                        return (
                          page === 1 ||
                          page === totalPages ||
                          Math.abs(page - currentPage) <= 1
                        );
                      })
                      .map((page, idx, arr) => {
                        const prevPage = arr[idx - 1];
                        const showEllipsis = prevPage && page - prevPage > 1;

                        return (
                          <div key={page} className="flex items-center gap-1">
                            {showEllipsis && (
                              <span className="px-2 text-xs text-gray-500">
                                ...
                              </span>
                            )}
                            <button
                              onClick={() => setCurrentPage(page)}
                              className={`h-8 w-8 rounded-lg text-xs font-medium transition-colors ${
                                currentPage === page
                                  ? "bg-stellar-500 text-white"
                                  : "border border-white/10 bg-white/5 text-gray-300 hover:border-stellar-400/30 hover:bg-stellar-500/10 hover:text-stellar-300"
                              }`}
                              aria-label={`Go to page ${page}`}
                              aria-current={
                                currentPage === page ? "page" : undefined
                              }
                            >
                              {page}
                            </button>
                          </div>
                        );
                      })}
                  </div>
                  <button
                    onClick={() =>
                      setCurrentPage((p) => Math.min(totalPages, p + 1))
                    }
                    disabled={currentPage === totalPages}
                    className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-gray-300 transition-colors hover:border-stellar-400/30 hover:bg-stellar-500/10 hover:text-stellar-300 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-white/10 disabled:hover:bg-white/5 disabled:hover:text-gray-300"
                    aria-label="Next page"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
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
  const { fetchTokenInfo, fetchTopHolders, fetchSupplyBreakdown } =
    useSoroban();

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
  }, [contractId, fetchTokenInfo, fetchTopHolders, fetchSupplyBreakdown]);

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
          <span className="text-xs text-gray-500">Contract ID:</span>
          <ExplorerLink
            type="contract"
            identifier={contractId}
            truncate={true}
            truncateChars={8}
            showCopy={true}
          />
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
          <InfoCard
            label="Admin"
            value={truncateAddress(tokenInfo.admin)}
            copyValue={tokenInfo.admin}
            isAddress={true}
          />
        </div>
      </section>

      {/* User Actions Panel (Burn Tokens) */}
      <UserPanel contractId={contractId} decimals={tokenInfo.decimals} />

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
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-medium uppercase tracking-wider text-gray-500">
            Top Holders
          </h2>
          {holders.length > 0 && (
            <button
              onClick={() => exportHoldersCsv(holders)}
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-gray-300 transition-colors hover:border-stellar-400/30 hover:bg-stellar-500/10 hover:text-stellar-300"
            >
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </button>
          )}
        </div>
        <HoldersTable holders={holders} />
      </section>

      {/* Vesting schedule */}
      <section aria-label="Vesting schedule" className="mt-10">
        <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-gray-500">
          Vesting Schedule
        </h2>
        <VestingProgress decimals={tokenInfo.decimals} />
      </section>

      {/* Transaction History */}
      <section aria-label="Transaction history" className="mt-16 border-t border-white/5 pt-10">
        <TransactionHistory
          contractId={contractId}
          decimals={tokenInfo.decimals}
          symbol={tokenInfo.symbol}
        />
      </section>

      {/* Token Activity Feed */}
      <section aria-label="Token activity feed" className="mt-10">
        <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-gray-500">
          Token Activity
        </h2>
        <ActivityFeed accountId={contractId} />
      </section>

      {/* Transfer Tokens Panel */}
      <TransferPanel
        contractId={contractId}
        tokenSymbol={tokenInfo.symbol}
        tokenDecimals={tokenInfo.decimals}
      />
    </div>
  );
}
