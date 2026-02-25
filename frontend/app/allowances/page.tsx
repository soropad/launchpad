"use client";

import React, { useState } from "react";
import { AllowanceManager } from "@/components/AllowanceManager";
import { AllowanceList } from "@/components/AllowanceList";
import { Input } from "@/components/ui/Input";
import { AlertCircle } from "lucide-react";

/**
 * AllowancesPage - Full-page allowance management interface
 *
 * Provides:
 * - Allowance manager (grant, revoke, transfer)
 * - List of current allowances
 * - Token contract filter
 */
export default function AllowancesPage() {
  const [selectedContractId, setSelectedContractId] = useState<string>("");
  const [activeSection, setActiveSection] = useState<"manage" | "view">("manage");

  // In a real implementation, this would fetch allowances from the contract
  const mockAllowances = [
    {
      id: "1",
      tokenContractId: selectedContractId || "C...",
      spenderAddress: "GCPFGJGZOXPF5EZBQ7TGVGVW4ZBDAJT3RDSAICABJ7GCM3QQHLJNZ7PZ",
      amount: "1000.00",
      expirationLedger: 1000000,
      isExpired: false,
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-black">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Allowance Manager</h1>
          <p className="text-gray-400">
            Manage SEP-41 token allowances. Grant, revoke, and utilize token approvals.
          </p>
        </div>

        {/* Contract Filter */}
        <div className="mb-8 glass-card p-6">
          <label className="block text-sm font-medium text-gray-300 mb-3">
            Filter by Token Contract (Optional)
          </label>
          <Input
            value={selectedContractId}
            onChange={(e) => setSelectedContractId(e.target.value)}
            placeholder="Enter token contract ID (C...) to filter"
            className="font-mono text-sm"
          />
          {selectedContractId && (
            <p className="text-xs text-gray-400 mt-2">
              Showing allowances for: {selectedContractId}
            </p>
          )}
        </div>

        {/* Section Tabs */}
        <div className="mb-8 flex gap-2 border-b border-white/10">
          <button
            onClick={() => setActiveSection("manage")}
            className={`px-4 py-3 font-medium text-sm transition-colors ${
              activeSection === "manage"
                ? "text-stellar-400 border-b-2 border-stellar-400"
                : "text-gray-400 hover:text-gray-300 border-b-2 border-transparent"
            }`}
          >
            Manage Allowances
          </button>
          <button
            onClick={() => setActiveSection("view")}
            className={`px-4 py-3 font-medium text-sm transition-colors ${
              activeSection === "view"
                ? "text-stellar-400 border-b-2 border-stellar-400"
                : "text-gray-400 hover:text-gray-300 border-b-2 border-transparent"
            }`}
          >
            View Allowances
          </button>
        </div>

        {/* Content */}
        {activeSection === "manage" && (
          <div className="mb-12">
            <AllowanceManager />
          </div>
        )}

        {activeSection === "view" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold text-white mb-4">Active Allowances</h2>
              <p className="text-sm text-gray-400 mb-4">
                View and manage all allowances granted to other addresses.
              </p>
            </div>

            {selectedContractId ? (
              <AllowanceList
                contractId={selectedContractId}
                allowances={mockAllowances}
                isLoading={false}
              />
            ) : (
              <div className="glass-card p-8 text-center">
                <AlertCircle className="h-8 w-8 text-gray-500 mx-auto mb-3" />
                <p className="text-gray-400 mb-2">No contract selected</p>
                <p className="text-xs text-gray-500">
                  Enter a token contract ID above to view allowances.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Help Section */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="glass-card p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-10 w-10 rounded-lg bg-stellar-400/20 flex items-center justify-center text-stellar-400 font-bold">
                1
              </div>
              <h3 className="font-semibold text-white">Grant Allowance</h3>
            </div>
            <p className="text-sm text-gray-400">
              Authorize a spender address to transfer tokens on your behalf up to a specified
              amount.
            </p>
          </div>

          <div className="glass-card p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-10 w-10 rounded-lg bg-stellar-400/20 flex items-center justify-center text-stellar-400 font-bold">
                2
              </div>
              <h3 className="font-semibold text-white">Revoke Allowance</h3>
            </div>
            <p className="text-sm text-gray-400">
              Remove a spender&apos;s ability to transfer your tokens. Revocation is instantaneous.
            </p>
          </div>

          <div className="glass-card p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-10 w-10 rounded-lg bg-stellar-400/20 flex items-center justify-center text-stellar-400 font-bold">
                3
              </div>
              <h3 className="font-semibold text-white">Transfer From</h3>
            </div>
            <p className="text-sm text-gray-400">
              Transfer tokens on behalf of another address if they have granted you an allowance.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
