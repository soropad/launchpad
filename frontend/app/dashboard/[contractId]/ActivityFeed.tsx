import { useEffect, useState, useCallback, useRef } from "react";
import { ArrowUpRight, ArrowRight, Loader2, ArrowLeftRight, Flame, Droplets } from "lucide-react";
import { fetchAccountOperations, truncateAddress, type TokenActivityInfo } from "@/lib/stellar";

export default function ActivityFeed({ accountId }: { accountId: string }) {
    const [operations, setOperations] = useState<TokenActivityInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [nextCursor, setNextCursor] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Use refs to avoid closure stale state in intervals
    const cursorRef = useRef<string | null>(null);
    cursorRef.current = nextCursor;

    const performFetch = useCallback(async (isLoadMore = false, isRefresh = false) => {
        try {
            if (!isLoadMore && !isRefresh) setLoading(true);
            if (isLoadMore) setLoadingMore(true);

            const cursorToUse = isLoadMore ? cursorRef.current : undefined;
            // Note: for a true auto-refresh we might want to fetch without cursor and prepend new ones,
            // but for simplicity we'll just reload the first page if it's a refresh interval.
            const fetchCursor = isRefresh ? undefined : cursorToUse;

            const { records, nextCursor: newCursor } = await fetchAccountOperations(
                accountId,
                fetchCursor ?? undefined,
                10
            );

            if (isLoadMore) {
                setOperations((prev) => [...prev, ...records]);
            } else {
                // First load or Refresh
                // If refresh, we might want to smartly prepend, but replacing is simpler for pagination reset.
                // Actually, just leaving it be or updating if head is different is better UX.
                setOperations(records);
            }

            if (!isRefresh || isLoadMore) {
                setNextCursor(newCursor);
            }
            setError(null);
        } catch (err) {
            if (!isRefresh) {
                setError("Failed to fetch activity feed.");
            }
        } finally {
            if (!isLoadMore && !isRefresh) setLoading(false);
            if (isLoadMore) setLoadingMore(false);
        }
    }, [accountId]);

    // Initial load
    useEffect(() => {
        performFetch();
    }, [performFetch]);

    // Auto-refresh every 30 seconds
    useEffect(() => {
        const interval = setInterval(() => {
            // Only auto-refresh if we haven't loaded more pages (to not mess up pagination)
            if (cursorRef.current === null || operations.length <= 10) {
                performFetch(false, true);
            }
        }, 30000);
        return () => clearInterval(interval);
    }, [performFetch, operations.length]);

    if (loading) {
        return (
            <div className="flex justify-center p-8">
                <Loader2 className="h-6 w-6 animate-spin text-stellar-400" />
            </div>
        );
    }

    if (error) {
        return <div className="p-4 text-center text-sm text-red-400">{error}</div>;
    }

    if (operations.length === 0) {
        return (
            <div className="glass-card p-8 text-center text-sm text-gray-500">
                No token activity found for this account/contract.
            </div>
        );
    }

    const getTypeIcon = (type: string) => {
        switch (type) {
            case "mint": return <Droplets className="h-4 w-4 text-blue-400" />;
            case "burn": return <Flame className="h-4 w-4 text-red-400" />;
            case "transfer": return <ArrowLeftRight className="h-4 w-4 text-green-400" />;
            default: return <ArrowRight className="h-4 w-4 text-gray-400" />;
        }
    };

    const getStyleForType = (type: string) => {
        switch (type) {
            case "mint": return "text-blue-400 bg-blue-400/10 border-blue-400/20";
            case "burn": return "text-red-400 bg-red-400/10 border-red-400/20";
            case "transfer": return "text-green-400 bg-green-400/10 border-green-400/20";
            default: return "text-gray-400 bg-gray-400/10 border-gray-400/20";
        }
    };

    return (
        <div className="glass-card overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-white/5 bg-white/5">
                            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Type</th>
                            <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Amount</th>
                            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">From</th>
                            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">To</th>
                            <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Time</th>
                            <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Tx</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {operations.map((op, i) => (
                            <tr key={`${op.id}-${i}`} className="transition-colors hover:bg-white/[0.02]">
                                <td className="px-4 py-3">
                                    <div className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${getStyleForType(op.type)}`}>
                                        {getTypeIcon(op.type)}
                                        {op.type}
                                    </div>
                                </td>
                                <td className="px-4 py-3 text-right font-mono text-white">
                                    {op.amount !== "-" ? op.amount : "-"}
                                </td>
                                <td className="px-4 py-3 font-mono text-xs text-stellar-300">
                                    {op.from !== "-" ? (
                                        <span title={op.from}>{truncateAddress(op.from, 5)}</span>
                                    ) : "-"}
                                </td>
                                <td className="px-4 py-3 font-mono text-xs text-stellar-300">
                                    {op.to !== "-" ? (
                                        <span title={op.to}>{truncateAddress(op.to, 5)}</span>
                                    ) : "-"}
                                </td>
                                <td className="px-4 py-3 text-right text-xs text-gray-400">
                                    {new Date(op.timestamp).toLocaleString(undefined, {
                                        month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
                                    })}
                                </td>
                                <td className="px-4 py-3 text-right">
                                    <a
                                        href={`https://stellar.expert/explorer/testnet/tx/${op.txHash}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 rounded text-xs text-stellar-400 hover:text-stellar-300 hover:underline"
                                        title="View on Stellar Expert"
                                    >
                                        View
                                        <ArrowUpRight className="h-3 w-3" />
                                    </a>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {nextCursor && (
                <div className="border-t border-white/5 p-4 text-center">
                    <button
                        onClick={() => performFetch(true)}
                        disabled={loadingMore}
                        className="btn-secondary inline-flex items-center gap-2 px-4 py-2 text-sm"
                    >
                        {loadingMore && <Loader2 className="h-4 w-4 animate-spin" />}
                        {loadingMore ? "Loading..." : "Load More"}
                    </button>
                </div>
            )}
        </div>
    );
}
