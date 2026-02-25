"use client";

import React from "react";
import { Copy, Trash2 } from "lucide-react";
import { CopyButton } from "@/components/ui/CopyButton";
import { Button } from "@/components/ui/Button";
import { truncateAddress } from "@/lib/stellar";

export interface AllowanceInfo {
  spenderAddress: string;
  amount: string;
  amountFormatted: string; // Human-readable with decimals
  expiresAt?: Date;
  isExpired?: boolean;
}

interface AllowanceCardProps {
  allowance: AllowanceInfo;
  onRevoke?: (spenderAddress: string) => void;
  isRevoking?: boolean;
}

/**
 * AllowanceCard - Display a single allowance grant
 */
export function AllowanceCard({ allowance, onRevoke, isRevoking }: AllowanceCardProps) {
  const expiresDate = allowance.expiresAt?.toLocaleDateString() || "N/A";
  const expiresTime = allowance.expiresAt?.toLocaleTimeString() || "";

  return (
    <div
      className={`glass-card p-4 ${allowance.isExpired ? "opacity-60" : ""} border border-white/10`}
    >
      <div className="space-y-3">
        {/* Spender Address */}
        <div>
          <p className="text-xs uppercase tracking-wider text-gray-500 mb-1">Spender</p>
          <div className="flex items-center justify-between">
            <span className="font-mono text-sm text-white">
              {truncateAddress(allowance.spenderAddress, 12)}
            </span>
            <CopyButton value={allowance.spenderAddress} label="Copy spender address" />
          </div>
        </div>

        {/* Amount */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs uppercase tracking-wider text-gray-500 mb-1">Allowance</p>
            <p className="text-lg font-semibold text-stellar-400">{allowance.amountFormatted}</p>
          </div>

          {/* Expiration */}
          <div>
            <p className="text-xs uppercase tracking-wider text-gray-500 mb-1">Expires</p>
            <div className="flex flex-col">
              <p className="text-sm text-white">{expiresDate}</p>
              {expiresTime && <p className="text-xs text-gray-400">{expiresTime}</p>}
              {allowance.isExpired && <p className="text-xs text-red-400 font-medium">Expired</p>}
            </div>
          </div>
        </div>

        {/* Revoke Button */}
        {onRevoke && !allowance.isExpired && (
          <div className="pt-2">
            <Button
              onClick={() => onRevoke(allowance.spenderAddress)}
              disabled={isRevoking}
              variant="secondary"
              className="w-full flex items-center justify-center gap-2 text-red-400 hover:bg-red-600/20"
            >
              <Trash2 className="h-4 w-4" />
              {isRevoking ? "Revoking..." : "Revoke Allowance"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
