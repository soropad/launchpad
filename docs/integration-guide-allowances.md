# Quick Integration Guide - Add Allowances to Dashboard

This guide shows how to quickly integrate the new allowance management feature into your existing SoroPad dashboard.

## Option 1: Add as Standalone Page (Recommended)

The allowances page is already available at `/dashboard/allowances` with no additional setup needed.

**To access it:**
1. Add a navigation link in your sidebar/header pointing to `/dashboard/allowances`
2. Component used: `AllowancesPage` (fully self-contained)

## Option 2: Add Tab to AdminPanel

If you want allowances in the token dashboard's AdminPanel:

### Step 1: Update AdminPanel.tsx

```tsx
// In app/dashboard/[contractId]/components/AdminPanel.tsx

import { AllowancesPanel } from "@/components/ui/AllowancesPanel";
import type { AllowanceInfo } from "@/components/ui/AllowanceCard";

interface AdminPanelProps {
  contractId: string;
}

export function AdminPanel({ contractId }: AdminPanelProps) {
  // ... existing code ...
  const [allowances, setAllowances] = useState<AllowanceInfo[]>([]);
  const [isLoadingAllowances, setIsLoadingAllowances] = useState(false);

  // Create new tab in your existing tabs structure:
  return (
    <Tabs defaultValue="mint">
      <TabsList>
        <TabsTrigger value="mint">Mint</TabsTrigger>
        <TabsTrigger value="burn">Burn</TabsTrigger>
        <TabsTrigger value="allowances">Allowances</TabsTrigger>
      </TabsList>

      {/* ... existing panels ... */}

      <TabsContent value="allowances">
        <AllowancesPanel
          tokenContractId={contractId}
          ownerAddress={publicKey}
          allowances={allowances}
          isLoadingAllowances={isLoadingAllowances}
          onRefreshAllowances={async () => {
            // Implement loading allowances
          }}
        />
      </TabsContent>
    </Tabs>
  );
}
```

## Option 3: Add Mini Allowances Widget to Token Dashboard

For a simplified allowance view in the main TokenDashboard:

```tsx
// In app/dashboard/[contractId]/TokenDashboard.tsx

import { AllowancesList } from "@/components/ui/AllowancesList";
import { useState, useEffect } from "react";

export default function TokenDashboard({ contractId }: { contractId: string }) {
  const [allowances, setAllowances] = useState<AllowanceInfo[]>([]);

  useEffect(() => {
    loadAllowances();
  }, [contractId]);

  return (
    <div className="space-y-6">
      {/* ... existing content ... */}

      {/* Allowances widget */}
      <div className="glass-card p-6 border border-white/10">
        <h2 className="text-xl font-bold text-white mb-4">Active Allowances</h2>
        <AllowancesList
          allowances={allowances.slice(0, 3)} // Show top 3
          onRefresh={loadAllowances}
        />
        <a
          href={`/dashboard/allowances?contract=${contractId}`}
          className="text-stellar-400 hover:underline text-sm mt-4 inline-block"
        >
          View all allowances →
        </a>
      </div>
    </div>
  );
}
```

## Components Reference

### ApproveForm
Single form for granting allowances.

**Props:**
```typescript
interface ApproveFormProps {
  onSuccess?: (txHash: string) => void;
  onError?: (error: string) => void;
}
```

**Usage:**
```tsx
<ApproveForm
  onSuccess={(hash) => console.log("Approved:", hash)}
  onError={(err) => console.error("Error:", err)}
/>
```

### RevokeAllowanceForm
Form for revoking allowances with confirmation.

**Props:**
```typescript
interface RevokeAllowanceFormProps {
  onSuccess?: (txHash: string) => void;
  onError?: (error: string) => void;
}
```

### TransferFromForm
Form for spending someone's allowance.

**Props:**
```typescript
interface TransferFromFormProps {
  onSuccess?: (txHash: string) => void;
  onError?: (error: string) => void;
}
```

### AllowancesPanel
Main component combining all three forms + list.

**Props:**
```typescript
interface AllowancesPanelProps {
  tokenContractId?: string;
  ownerAddress?: string;
  allowances?: AllowanceInfo[];
  isLoadingAllowances?: boolean;
  allowancesError?: string | null;
  onRefreshAllowances?: () => Promise<void>;
  onRevokeAllowance?: (spenderAddress: string) => Promise<void>;
}
```

**Usage:**
```tsx
<AllowancesPanel
  tokenContractId={contractId}
  ownerAddress={publicKey}
  allowances={allowances}
  isLoadingAllowances={loading}
  onRefreshAllowances={loadAllowances}
  onRevokeAllowance={revokeAllowance}
/>
```

### AllowancesList
Read-only component displaying allowances.

**Props:**
```typescript
interface AllowancesListProps {
  allowances: AllowanceInfo[];
  isLoading?: boolean;
  error?: string | null;
  tokenAddress?: string;
  ownerAddress?: string;
  onRevoke?: (spenderAddress: string) => Promise<void>;
  onRefresh?: () => Promise<void>;
}
```

### AllowanceCard
Individual allowance display card.

**Props:**
```typescript
interface AllowanceCardProps {
  allowance: AllowanceInfo;
  onRevoke?: (spenderAddress: string) => void;
  isRevoking?: boolean;
}
```

## Hooks Reference

### useTransactionSimulator

New methods available:

```typescript
const simulator = useTransactionSimulator();

// Check approve
await simulator.checkApprove(
  contractId,
  ownerAddress,
  spenderAddress,
  amount,
  expirationLedger
);

// Check revoke
await simulator.checkRevokeAllowance(
  contractId,
  ownerAddress,
  spenderAddress
);

// checkTransferFrom already existed
await simulator.checkTransferFrom(
  contractId,
  spenderAddress,
  fromAddress,
  toAddress,
  amount
);
```

## Common Implementation Patterns

### Pattern 1: Simple Allowance Granting

```tsx
export function QuickApprove() {
  return (
    <ApproveForm
      onSuccess={(hash) => {
        toast.success(`Approved! TX: ${hash}`);
      }}
      onError={(err) => {
        toast.error(err);
      }}
    />
  );
}
```

### Pattern 2: Allowance Management Dashboard

```tsx
export function AllowanceDashboard({ contractId }: { contractId: string }) {
  const [allowances, setAllowances] = useState<AllowanceInfo[]>([]);
  const { publicKey } = useWallet();

  const loadAllowances = async () => {
    // TODO: fetch from RPC
    const result = await fetchAllowances(contractId, publicKey);
    setAllowances(result);
  };

  return (
    <AllowancesPanel
      tokenContractId={contractId}
      ownerAddress={publicKey}
      allowances={allowances}
      onRefreshAllowances={loadAllowances}
      onRevokeAllowance={async (spender) => {
        // TODO: submit revoke transaction
        await loadAllowances();
      }}
    />
  );
}
```

### Pattern 3: Embedded Widget

```tsx
export function TokenCard({ token }: { token: Token }) {
  const [allowances, setAllowances] = useState<AllowanceInfo[]>([]);

  return (
    <div className="p-4 border rounded-lg">
      {/* Token info */}
      <h3>{token.name}</h3>

      {/* Allowances preview */}
      <div className="mt-4">
        <AllowancesList
          allowances={allowances}
          onRefresh={async () => {
            // reload
          }}
        />
      </div>

      {/* View more link */}
      <a href={`/dashboard/allowances?contract=${token.id}`}>
        Manage allowances →
      </a>
    </div>
  );
}
```

## File Locations

### Components
- `/components/forms/ApproveForm.tsx`
- `/components/forms/RevokeAllowanceForm.tsx`
- `/components/forms/TransferFromForm.tsx`
- `/components/ui/AllowancesPanel.tsx`
- `/components/ui/AllowancesList.tsx`
- `/components/ui/AllowanceCard.tsx`
- `/components/ui/Tabs.tsx`
- `/components/ui/Alert.tsx`

### Pages
- `/app/dashboard/allowances/page.tsx`
- `/app/dashboard/allowances/AllowancesPage.tsx`

### Hooks & Lib
- `/hooks/useTransactionSimulator.ts` (updated)
- `/lib/transactionSimulator.ts` (updated)
- `/lib/utils.ts` (new)

## Testing Locally

1. Navigate to `/dashboard/allowances`
2. Enter a test token contract ID
3. Click "Load" to attempt loading allowances
4. Try the "Grant" tab to see form validation
5. Try "Revoke" and "Spend" tabs

## Next Steps

1. **Implement RPC calls** to fetch actual allowances from the chain
2. **Add transaction signing** using Freighter wallet
3. **Connect to dashboard navigation** in the sidebar
4. **Add notifications** for success/error messages
5. **Test with real contracts** on testnet

## Troubleshooting

### Form validation not working
- Check that addresses match regex patterns in schemas
- Ensure zod resolver is properly configured

### Pre-flight checks failing
- Verify network configuration is correct
- Check contract ID is valid
- Ensure RPC endpoint is accessible

### Components not displaying
- Check imports are correct
- Verify UI component exports
- Check styled layout cascade

## Support

For issues or questions:
1. Check the [allowance-feature-guide.md](./allowance-feature-guide.md)
2. Review the form implementations
3. Check transaction simulator implementation
