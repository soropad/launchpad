"use client";

import React, { useState } from "react";
import { ApproveForm } from "@/components/forms/ApproveForm";
import { RevokeAllowanceForm } from "@/components/forms/RevokeAllowanceForm";
import { TransferFromForm } from "@/components/forms/TransferFromForm";
import { AlertCircle, CheckCircle, AlertTriangle } from "lucide-react";

type TabType = "grant" | "revoke" | "transfer";

interface NotificationState {
  type: "success" | "error";
  message: string;
}

/**
 * AllowanceManager - Complete allowance management interface
 *
 * Provides a tabbed interface for:
 * - Granting allowances to spenders
 * - Revoking existing allowances
 * - Transferring tokens using allowances
 */
export function AllowanceManager() {
  const [activeTab, setActiveTab] = useState<TabType>("grant");
  const [notification, setNotification] = useState<NotificationState | null>(null);

  const handleSuccess = (txHash: string, tab: TabType) => {
    const messages = {
      grant: "Allowance granted successfully!",
      revoke: "Allowance revoked successfully!",
      transfer: "Transfer completed successfully!",
    };

    setNotification({
      type: "success",
      message: `${messages[tab]} TX: ${txHash}`,
    });

    setTimeout(() => setNotification(null), 5000);
  };

  const handleError = (error: string) => {
    setNotification({
      type: "error",
      message: error,
    });

    setTimeout(() => setNotification(null), 5000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white mb-2">Token Allowances</h1>
        <p className="text-sm text-gray-400">
          Manage SEP-41 token allowances. Grant spenders permission to transfer tokens on your
          behalf, or transfer tokens using allowances granted to you.
        </p>
      </div>

      {/* Notification */}
      {notification && (
        <div
          className={`flex items-center gap-3 p-4 rounded-lg border ${
            notification.type === "success"
              ? "bg-green-600/10 border-green-600/50"
              : "bg-red-600/10 border-red-600/50"
          }`}
        >
          {notification.type === "success" ? (
            <CheckCircle className="h-5 w-5 text-green-400 flex-shrink-0" />
          ) : (
            <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0" />
          )}
          <p
            className={
              notification.type === "success" ? "text-sm text-green-300" : "text-sm text-red-300"
            }
          >
            {notification.message}
          </p>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-white/10">
        <TabButton
          tab="grant"
          label="Grant Allowance"
          active={activeTab === "grant"}
          onClick={() => setActiveTab("grant")}
        />
        <TabButton
          tab="revoke"
          label="Revoke Allowance"
          active={activeTab === "revoke"}
          onClick={() => setActiveTab("revoke")}
        />
        <TabButton
          tab="transfer"
          label="Transfer From"
          active={activeTab === "transfer"}
          onClick={() => setActiveTab("transfer")}
        />
      </div>

      {/* Tab Content */}
      <div className="glass-card p-6">
        {activeTab === "grant" && (
          <ApproveForm
            onSuccess={(hash) => handleSuccess(hash, "grant")}
            onError={handleError}
          />
        )}

        {activeTab === "revoke" && (
          <RevokeAllowanceForm
            onSuccess={(hash) => handleSuccess(hash, "revoke")}
            onError={handleError}
          />
        )}

        {activeTab === "transfer" && (
          <TransferFromForm
            onSuccess={(hash) => handleSuccess(hash, "transfer")}
            onError={handleError}
          />
        )}
      </div>

      {/* Info Section */}
      <div className="rounded-lg bg-blue-600/10 border border-blue-600/50 p-4">
        <div className="flex gap-3">
          <AlertTriangle className="h-5 w-5 text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="space-y-2">
            <p className="text-sm font-medium text-blue-300">How allowances work:</p>
            <ul className="text-xs text-blue-200 space-y-1 list-disc list-inside">
              <li>
                <strong>Grant:</strong> Set the maximum amount a spender can transfer on your
                behalf
              </li>
              <li>
                <strong>Revoke:</strong> Remove a spender&apso;s ability to transfer your tokens
              </li>
              <li>
                <strong>Transfer From:</strong> Transfer tokens if you have an allowance from
                another address
              </li>
              <li>Allowances have an expiration ledger for security</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

interface TabButtonProps {
  tab: TabType;
  label: string;
  active: boolean;
  onClick: () => void;
}

function TabButton({ label, active, onClick }: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-3 font-medium text-sm transition-colors ${
        active
          ? "text-stellar-400 border-b-2 border-stellar-400"
          : "text-gray-400 hover:text-gray-300 border-b-2 border-transparent"
      }`}
    >
      {label}
    </button>
  );
}
