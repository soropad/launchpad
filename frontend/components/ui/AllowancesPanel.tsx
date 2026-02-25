"use client";

import React, { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/Tabs";
import { ApproveForm } from "@/components/forms/ApproveForm";
import { RevokeAllowanceForm } from "@/components/forms/RevokeAllowanceForm";
import { TransferFromForm } from "@/components/forms/TransferFromForm";
import { AllowancesList, type AllowanceInfo } from "@/components/ui/AllowancesList";
import { AlertCircle } from "lucide-react";

interface AllowancesPanelProps {
  tokenContractId?: string;
  ownerAddress?: string;
  allowances?: AllowanceInfo[];
  isLoadingAllowances?: boolean;
  allowancesError?: string | null;
  onRefreshAllowances?: () => Promise<void>;
  onRevokeAllowance?: (spenderAddress: string) => Promise<void>;
}

export type AllowanceTab = "grant" | "revoke" | "spend" | "view";

/**
 * AllowancesPanel - Complete allowance management interface
 * Combines granting, revoking, spending, and viewing allowances
 */
export function AllowancesPanel({
  tokenContractId,
  ownerAddress,
  allowances = [],
  isLoadingAllowances,
  allowancesError,
  onRefreshAllowances,
  onRevokeAllowance,
}: AllowancesPanelProps) {
  const [activeTab, setActiveTab] = useState<AllowanceTab>("view");
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleActionSuccess = (action: string, txHash: string) => {
    setSuccessMessage(`${action} successful! TX: ${txHash}`);
    setErrorMessage(null);
    // Clear success message after 5 seconds
    setTimeout(() => setSuccessMessage(null), 5000);
  };

  const handleActionError = (error: string) => {
    setErrorMessage(error);
    setSuccessMessage(null);
  };

  return (
    <div className="space-y-6">
      {/* Success/Error Alerts */}
      {successMessage && (
        <div className="flex items-center gap-3 p-4 bg-green-600/10 border border-green-600/50 rounded-lg">
          <div className="h-2 w-2 rounded-full bg-green-400 flex-shrink-0" />
          <p className="text-sm text-green-300">{successMessage}</p>
        </div>
      )}

      {errorMessage && (
        <div className="flex items-center gap-3 p-4 bg-red-600/10 border border-red-600/50 rounded-lg">
          <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0" />
          <p className="text-sm text-red-300">{errorMessage}</p>
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as AllowanceTab)}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="view">View</TabsTrigger>
          <TabsTrigger value="grant">Grant</TabsTrigger>
          <TabsTrigger value="revoke">Revoke</TabsTrigger>
          <TabsTrigger value="spend">Spend</TabsTrigger>
        </TabsList>

        {/* View Tab - List all allowances */}
        <TabsContent value="view" className="space-y-4">
          <div className="text-sm text-gray-400 mb-4">
            View all active allowances for your tokens or on behalf of others.
          </div>
          <AllowancesList
            allowances={allowances}
            isLoading={isLoadingAllowances}
            error={allowancesError}
            tokenAddress={tokenContractId}
            ownerAddress={ownerAddress}
            onRevoke={onRevokeAllowance}
            onRefresh={onRefreshAllowances}
          />
        </TabsContent>

        {/* Grant Tab - Create new allowance */}
        <TabsContent value="grant" className="space-y-4">
          <div className="bg-blue-600/10 border border-blue-600/50 rounded-lg p-4 mb-4">
            <p className="text-sm text-blue-300">
              Allow another address to spend your tokens. You set the maximum amount they can
              spend.
            </p>
          </div>
          <ApproveForm
            onSuccess={(txHash) => handleActionSuccess("Allowance grant", txHash)}
            onError={handleActionError}
          />
        </TabsContent>

        {/* Revoke Tab - Revoke existing allowance */}
        <TabsContent value="revoke" className="space-y-4">
          <div className="bg-yellow-600/10 border border-yellow-600/50 rounded-lg p-4 mb-4">
            <p className="text-sm text-yellow-300">
              Revoke a previously granted allowance. The spender will no longer be able to
              transfer your tokens.
            </p>
          </div>
          <RevokeAllowanceForm
            onSuccess={(txHash) => handleActionSuccess("Allowance revocation", txHash)}
            onError={handleActionError}
          />
        </TabsContent>

        {/* Spend Tab - Use someone else's allowance */}
        <TabsContent value="spend" className="space-y-4">
          <div className="bg-purple-600/10 border border-purple-600/50 rounded-lg p-4 mb-4">
            <p className="text-sm text-purple-300">
              Transfer tokens on behalf of another address if they granted you an allowance.
            </p>
          </div>
          <TransferFromForm
            onSuccess={(txHash) => handleActionSuccess("Transfer from allowance", txHash)}
            onError={handleActionError}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
