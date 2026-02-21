"use client";

import { useState, useCallback } from "react";
import { Loader2, AlertCircle, Clock, Unlock, Lock } from "lucide-react";
import {
  fetchVestingSchedule,
  fetchCurrentLedger,
  formatTokenAmount,
  truncateAddress,
  type VestingScheduleInfo,
} from "@/lib/stellar";

// ---------------------------------------------------------------------------
// Vesting display (progress bars + timeline)
// ---------------------------------------------------------------------------

function VestingDisplay({
  schedule,
  currentLedger,
  decimals,
}: {
  schedule: VestingScheduleInfo;
  currentLedger: number;
  decimals: number;
}) {
  const totalBig = BigInt(schedule.totalAmount);
  const releasedBig = BigInt(schedule.released);

  // Replicate the contract's cliff + linear vesting formula
  let vestedBig: bigint;
  if (currentLedger < schedule.cliffLedger) {
    vestedBig = 0n;
  } else if (currentLedger >= schedule.endLedger) {
    vestedBig = totalBig;
  } else {
    const elapsed = BigInt(currentLedger - schedule.cliffLedger);
    const duration = BigInt(schedule.endLedger - schedule.cliffLedger);
    vestedBig = (totalBig * elapsed) / duration;
  }

  const vestedPercent =
    totalBig > 0n ? Number((vestedBig * 10000n) / totalBig) / 100 : 0;
  const releasedPercent =
    totalBig > 0n ? Number((releasedBig * 10000n) / totalBig) / 100 : 0;

  // Timeline cursor position (0–100 %)
  const range = schedule.endLedger - schedule.cliffLedger;
  let timelinePos = 0;
  if (currentLedger >= schedule.endLedger) {
    timelinePos = 100;
  } else if (currentLedger > schedule.cliffLedger && range > 0) {
    timelinePos =
      ((currentLedger - schedule.cliffLedger) / range) * 100;
  }

  // Status label
  const statusLabel = schedule.revoked
    ? "Revoked"
    : currentLedger < schedule.cliffLedger
      ? "Cliff pending"
      : currentLedger >= schedule.endLedger
        ? "Fully vested"
        : "Vesting";

  const statusColor = schedule.revoked
    ? "text-red-400"
    : currentLedger >= schedule.endLedger
      ? "text-green-400"
      : "text-stellar-400";

  return (
    <div className="space-y-6">
      {/* Info cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="glass-card p-3">
          <span className="text-xs font-medium uppercase tracking-wider text-gray-500">
            Status
          </span>
          <p className={`mt-1 text-sm font-semibold ${statusColor}`}>
            {statusLabel}
          </p>
        </div>
        <div className="glass-card p-3">
          <span className="text-xs font-medium uppercase tracking-wider text-gray-500">
            Unlock %
          </span>
          <p className="mt-1 text-sm font-semibold text-white">
            {vestedPercent.toFixed(2)}%
          </p>
        </div>
        <div className="glass-card p-3">
          <span className="text-xs font-medium uppercase tracking-wider text-gray-500">
            Vested
          </span>
          <p className="mt-1 text-sm font-semibold text-white">
            {formatTokenAmount(vestedBig.toString(), decimals)}
          </p>
        </div>
        <div className="glass-card p-3">
          <span className="text-xs font-medium uppercase tracking-wider text-gray-500">
            Released
          </span>
          <p className="mt-1 text-sm font-semibold text-white">
            {formatTokenAmount(schedule.released, decimals)}
          </p>
        </div>
      </div>

      {/* Vested progress bar */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-xs font-medium text-gray-400">
            <Unlock className="h-3 w-3" /> Vested
          </span>
          <span className="text-xs font-mono text-gray-500">
            {formatTokenAmount(vestedBig.toString(), decimals)} /{" "}
            {formatTokenAmount(schedule.totalAmount, decimals)}
          </span>
        </div>
        <div className="h-3 w-full overflow-hidden rounded-full border border-white/5 bg-void-800">
          <div
            className="h-full rounded-full bg-gradient-to-r from-stellar-400 to-stellar-600 transition-all duration-700 ease-out shadow-[0_0_10px_rgba(45,125,255,0.3)]"
            style={{ width: `${Math.min(vestedPercent, 100)}%` }}
          />
        </div>
      </div>

      {/* Released progress bar */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-xs font-medium text-gray-400">
            <Lock className="h-3 w-3" /> Released
          </span>
          <span className="text-xs font-mono text-gray-500">
            {formatTokenAmount(schedule.released, decimals)} /{" "}
            {formatTokenAmount(schedule.totalAmount, decimals)}
          </span>
        </div>
        <div className="h-3 w-full overflow-hidden rounded-full border border-white/5 bg-void-800">
          <div
            className="h-full rounded-full bg-gradient-to-r from-green-500 to-green-400 transition-all duration-700 ease-out shadow-[0_0_10px_rgba(34,197,94,0.3)]"
            style={{ width: `${Math.min(releasedPercent, 100)}%` }}
          />
        </div>
      </div>

      {/* Timeline */}
      <div>
        <p className="mb-3 flex items-center gap-1.5 text-xs font-medium text-gray-400">
          <Clock className="h-3 w-3" /> Timeline
        </p>

        <div className="relative pb-8 pt-8">
          {/* Background track */}
          <div className="h-1.5 w-full rounded-full border border-white/5 bg-void-800" />

          {/* Filled portion */}
          <div
            className="absolute left-0 top-8 h-1.5 rounded-full bg-gradient-to-r from-stellar-500 to-stellar-400"
            style={{ width: `${timelinePos}%` }}
          />

          {/* Current position marker */}
          {currentLedger >= schedule.cliffLedger &&
            currentLedger < schedule.endLedger && (
              <div
                className="absolute flex flex-col items-center"
                style={{
                  left: `${timelinePos}%`,
                  top: 0,
                  transform: "translateX(-50%)",
                }}
              >
                <span className="whitespace-nowrap text-[10px] font-mono text-stellar-300">
                  L{currentLedger.toLocaleString()}
                </span>
                <div className="mt-0.5 h-3 w-0.5 bg-stellar-400" />
                <div className="h-3 w-3 rounded-full border-2 border-stellar-400 bg-void-900 shadow-[0_0_8px_rgba(45,125,255,0.5)]" />
              </div>
            )}

          {/* Cliff label */}
          <div className="absolute left-0 top-12 flex flex-col items-start">
            <div className="h-2 w-0.5 bg-gray-600" />
            <span className="mt-0.5 text-[10px] font-mono text-gray-500">
              Cliff: L{schedule.cliffLedger.toLocaleString()}
            </span>
          </div>

          {/* End label */}
          <div className="absolute right-0 top-12 flex flex-col items-end">
            <div className="ml-auto h-2 w-0.5 bg-gray-600" />
            <span className="mt-0.5 text-[10px] font-mono text-gray-500">
              End: L{schedule.endLedger.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* Recipient */}
      <div className="text-xs text-gray-500">
        Recipient:{" "}
        <span className="font-mono text-gray-400">
          {truncateAddress(schedule.recipient, 6)}
        </span>
        {schedule.revoked && (
          <span className="ml-2 text-red-400">(Revoked)</span>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main exported component — lookup form + display
// ---------------------------------------------------------------------------

export default function VestingProgress({ decimals }: { decimals: number }) {
  const [vestingContract, setVestingContract] = useState("");
  const [recipient, setRecipient] = useState("");
  const [schedule, setSchedule] = useState<VestingScheduleInfo | null>(null);
  const [currentLedger, setCurrentLedger] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lookup = useCallback(async () => {
    if (!vestingContract.trim() || !recipient.trim()) return;

    setLoading(true);
    setError(null);
    setSchedule(null);

    try {
      const [sched, ledger] = await Promise.all([
        fetchVestingSchedule(vestingContract.trim(), recipient.trim()),
        fetchCurrentLedger(),
      ]);
      setSchedule(sched);
      setCurrentLedger(ledger);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to fetch vesting schedule.",
      );
    } finally {
      setLoading(false);
    }
  }, [vestingContract, recipient]);

  return (
    <div className="space-y-4">
      {/* Lookup form */}
      <div className="glass-card space-y-3 p-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-400">
            Vesting Contract ID
          </label>
          <input
            type="text"
            value={vestingContract}
            onChange={(e) => setVestingContract(e.target.value)}
            placeholder="C… or G…"
            className="w-full rounded-lg border border-white/10 bg-void-800 px-3 py-2 text-sm text-white placeholder-gray-600 outline-none focus:border-stellar-500 focus:ring-1 focus:ring-stellar-500"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-400">
            Recipient Address
          </label>
          <input
            type="text"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            placeholder="G…"
            className="w-full rounded-lg border border-white/10 bg-void-800 px-3 py-2 text-sm text-white placeholder-gray-600 outline-none focus:border-stellar-500 focus:ring-1 focus:ring-stellar-500"
          />
        </div>
        <button
          onClick={lookup}
          disabled={loading || !vestingContract.trim() || !recipient.trim()}
          className="btn-primary w-full py-2 text-sm disabled:opacity-40"
        >
          {loading ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </span>
          ) : (
            "Look Up Schedule"
          )}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="glass-card flex items-start gap-3 p-4 text-sm text-red-400">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {/* Result */}
      {schedule && (
        <div className="glass-card p-4">
          <VestingDisplay
            schedule={schedule}
            currentLedger={currentLedger}
            decimals={decimals}
          />
        </div>
      )}
    </div>
  );
}
