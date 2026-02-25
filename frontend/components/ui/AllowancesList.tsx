"use client";

import React, { useState } from "react";
import { Loader2, AlertCircle, Eye, EyeOff } from "lucide-react";
import { AllowanceCard, type AllowanceInfo } from "@/components/ui/AllowanceCard";
import { Button } from "@/components/ui/Button";

export type { AllowanceInfo };

interface AllowancesListProps {
  allowances: AllowanceInfo[];
  isLoading?: boolean;
  error?: string | null;
  tokenAddress?: string;
  ownerAddress?: string;
  onRevoke?: (spenderAddress: string) => Promise<void>;
  onRefresh?: () => Promise<void>;
}

/**
 * AllowancesList - Display all active allowances for a token
 */
export function AllowancesList({
  allowances,
  isLoading,
  error,
  tokenAddress,
  ownerAddress,
  onRevoke,
  onRefresh,
}: AllowancesListProps) {
  const [revokingSpender, setRevokingSpender] = useState<string | null>(null);
  const [showExpired, setShowExpired] = useState(false);

  const activeAllowances = allowances.filter((a) => !a.isExpired);
  const expiredAllowances = allowances.filter((a) => a.isExpired);

  const displayAllowances = showExpired ? allowances : activeAllowances;

  const handleRevoke = async (spenderAddress: string) => {
    if (!onRevoke) return;

    setRevokingSpender(spenderAddress);
    try {
      await onRevoke(spenderAddress);
    } finally {
      setRevokingSpender(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-stellar-400" />
        <p className="text-sm text-gray-400">Loading allowances...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
        <AlertCircle className="h-8 w-8 text-red-400" />
        <p className="text-sm text-gray-400">{error}</p>
        {onRefresh && (
          <Button onClick={onRefresh} variant="secondary" className="text-sm">
            Try Again
          </Button>
        )}
      </div>
    );
  }

  if (allowances.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
        <AlertCircle className="h-8 w-8 text-gray-600" />
        <div>
          <p className="text-sm font-medium text-gray-300">No allowances</p>
          <p className="text-xs text-gray-500 mt-1">
            {ownerAddress
              ? "You haven't granted any allowances yet."
              : "No allowances found for this token."}
          </p>
        </div>
        {onRefresh && (
          <Button onClick={onRefresh} variant="secondary" className="text-sm mt-2">
            Refresh
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with Expire Toggle */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">
            Allowances
            <span className="text-sm font-normal text-gray-400 ml-2">
              ({displayAllowances.length})
            </span>
          </h3>
          {tokenAddress && (
            <p className="text-xs text-gray-500 font-mono mt-1">
              {tokenAddress.slice(0, 12)}...
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          {expiredAllowances.length > 0 && (
            <Button
              onClick={() => setShowExpired(!showExpired)}
              variant="secondary"
              className="flex items-center gap-2 text-sm"
            >
              {showExpired ? (
                <>
                  <EyeOff className="h-4 w-4" />
                  Hide Expired
                </>
              ) : (
                <>
                  <Eye className="h-4 w-4" />
                  Show Expired ({expiredAllowances.length})
                </>
              )}
            </Button>
          )}

          {onRefresh && (
            <Button onClick={onRefresh} variant="secondary" className="text-sm">
              Refresh
            </Button>
          )}
        </div>
      </div>

      {/* Allowances Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {displayAllowances.map((allowance) => (
          <AllowanceCard
            key={allowance.spenderAddress}
            allowance={allowance}
            onRevoke={onRevoke ? handleRevoke : undefined}
            isRevoking={revokingSpender === allowance.spenderAddress}
          />
        ))}
      </div>

      {/* Separate Expired Warning */}
      {showExpired && expiredAllowances.length > 0 && (
        <div className="mt-6 pt-6 border-t border-white/10">
          <p className="text-xs uppercase tracking-wider text-gray-500 mb-3">
            Expired Allowances ({expiredAllowances.length})
          </p>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 opacity-60">
            {expiredAllowances.map((allowance) => (
              <AllowanceCard key={allowance.spenderAddress} allowance={allowance} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
