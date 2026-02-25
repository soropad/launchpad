# Token Allowances Feature - Implementation Guide

## Overview

This guide documents the token allowance management UI system that enables users to:
- **Grant allowances** to spender addresses
- **View all active allowances** for a token
- **Revoke allowances** when no longer needed
- **Execute transfer_from** using granted allowances

## Architecture

### Components Structure

```
Components Hierarchy:
├── AllowancesPanel (main tab container)
│   ├── ApproveForm (grant allowance)
│   ├── RevokeAllowanceForm (revoke allowance)
│   ├── TransferFromForm (spend allowance)
│   └── AllowancesList (view allowances)
│       └── AllowanceCard (individual allowance display)
│
Pages:
└── app/dashboard/allowances/
    ├── page.tsx (route)
    └── AllowancesPage.tsx (page component)
```

### File Organization

**Forms (in `components/forms/`):**
- `ApproveForm.tsx` - Grant allowance with amount and expiration
- `RevokeAllowanceForm.tsx` - Revoke granted allowance
- `TransferFromForm.tsx` - Transfer using someone's allowance

**UI Components (in `components/ui/`):**
- `AllowancesPanel.tsx` - Main tab-based interface
- `AllowancesList.tsx` - List of allowances with filter/sort
- `AllowanceCard.tsx` - Individual allowance display card
- `Tabs.tsx` - Simple tab component
- `Alert.tsx` - Alert messages

**Hooks (in `hooks/`):**
- `useTransactionSimulator.ts` - Extended with allowance methods

**Libraries (in `lib/`):**
- `transactionSimulator.ts` - Simulation functions for allowances
- `utils.ts` - Helper utilities (cn function)

**Pages (in `app/dashboard/`):**
- `allowances/page.tsx` - Route definition
- `allowances/AllowancesPage.tsx` - Full-page component

## Feature Breakdown

### 1. Grant Allowance (Approve)

**Location:** Tab 1 - "Grant" in AllowancesPanel

**Form Fields:**
- Token Contract ID (required)
- Spender Address (required)
- Amount to approve (required, positive)
- Expiration Days (optional, default 365)

**Flow:**
1. User enters contract ID, spender address, and amount
2. System runs pre-flight check via `simulator.checkApprove()`
3. On success, displays success status
4. User signs transaction (implementation needed)
5. Transaction submitted to chain

**Pre-flight Checks:**
- Valid contract and spender addresses
- Amount is positive
- No contract-level restrictions

### 2. Revoke Allowance

**Location:** Tab 2 - "Revoke" in AllowancesPanel

**Form Fields:**
- Token Contract ID (required)
- Spender Address (required)

**Flow:**
1. User enters contract ID and spender address
2. System runs pre-flight check via `simulator.checkRevokeAllowance()`
3. On success, shows confirmation dialog
4. User confirms revocation
5. User signs transaction
6. Transaction submitted (sets allowance to 0)

**Safety Features:**
- Confirmation dialog before revocation
- Clear warning about what will happen

### 3. Transfer From (Spend Allowance)

**Location:** Tab 3 - "Spend" in AllowancesPanel

**Form Fields:**
- Token Contract ID (required)
- Source Address (owner who granted allowance)
- Recipient Address (where tokens go)
- Amount (required, positive)

**Flow:**
1. User enters contract ID, source, recipient, and amount
2. System runs pre-flight check via `simulator.checkTransferFrom()`
3. On success, displays validation status
4. User signs transaction (as spender)
5. Transaction submitted

**Pre-flight Checks:**
- Valid addresses and contract
- Spender has sufficient allowance
- No frozen accounts
- Valid amount

### 4. View Allowances

**Location:** Tab 4 - "View" in AllowancesPanel

**Features:**
- Display all active allowances for a token
- Show spender address, amount, and expiration
- Toggle to show/hide expired allowances
- Quick revoke button on each allowance
- Refresh button to reload data
- Error handling and loading states

**Data Display:**
```typescript
interface AllowanceInfo {
  spenderAddress: string;      // Address that received the allowance
  amount: string;              // Raw amount (as i128)
  amountFormatted: string;     // Human-readable with decimals
  expiresAt?: Date;            // Optional expiration date
  isExpired?: boolean;         // Whether allowance has expired
}
```

## Integration Points

### 1. Dashboard Navigation

Add to dashboard sidebar navigation:
```tsx
{
  href: "/dashboard/allowances",
  label: "Allowances",
  icon: <Key className="h-4 w-4" />,
}
```

### 2. Token Dashboard Integration

Add to AdminPanel or TokenDashboard:
```tsx
<AllowancesPanel
  tokenContractId={contractId}
  ownerAddress={publicKey}
  allowances={allowances}
  isLoadingAllowances={isLoading}
  allowancesError={error}
  onRefreshAllowances={loadAllowances}
  onRevokeAllowance={revokeAllowance}
/>
```

## Implementation Requirements

### 1. Transaction Simulation (✅ COMPLETE)

Pre-flight checks are already implemented via:

**For Approve:**
```typescript
await simulator.checkApprove(
  contractId,
  ownerAddress,
  spenderAddress,
  amount,
  expirationLedger
);
```

**For Revoke:**
```typescript
await simulator.checkRevokeAllowance(
  contractId,
  ownerAddress,
  spenderAddress
);
```

**For Transfer From:**
```typescript
await simulator.checkTransferFrom(
  contractId,
  spenderAddress,
  fromAddress,
  toAddress,
  amount
);
```

### 2. RPC Calls - TODO

The following need to be implemented in AllowancesPage.tsx:

**Fetch Allowances:**
```typescript
// TODO: Implement RPC call to list all allowances for an account
async function loadAllowances() {
  const rpc = new rpc.Server(networkConfig.rpcUrl);
  // Use rpc.getContractData() or similar to fetch allowances
  // Parse the DataKey::Allowance(owner, spender) entries
}
```

**Get Single Allowance:**
```typescript
// Query for a specific allowance
async function getAllowance(
  contractId: string,
  ownerAddress: string,
  spenderAddress: string
): Promise<i128> {
  // Make RPC call to simulate "allowance" contract method
  // Return the allowance amount
}
```

### 3. Transaction Signing - TODO

Both forms and functions need to implement actual signing:

```typescript
// Example pattern (fill in with actual Freighter signing):
const onSubmit = async () => {
  // 1. Build transaction with contract.call() for the method
  const tx = new TransactionBuilder(account, {
    fee: "100",
    networkPassphrase: networkConfig.passphrase,
  })
    .addOperation(contract.call("approve", ...args))
    .setTimeout(30)
    .build();

  // 2. Get signature from Freighter
  const signedTx = await wallet.signTransaction(tx);

  // 3. Submit to network
  const response = await rpc.sendTransaction(signedTx);
  
  // 4. Poll for completion
  const result = await rpc.pollTransaction(response.hash);
  
  return result.hash;
};
```

## Hooks and Functions

### useTransactionSimulator Extensions

**New Methods:**

```typescript
// Check if approve will succeed
simulator.checkApprove(
  contractId: string,
  ownerAddress: string,
  spenderAddress: string,
  amount: bigint | string,
  expirationLedger?: number
): Promise<PreflightCheckResult>

// Check if revoke will succeed
simulator.checkRevokeAllowance(
  contractId: string,
  ownerAddress: string,
  spenderAddress: string
): Promise<PreflightCheckResult>
```

### Error Messages

Pre-flight check errors are user-friendly via `parseSorobanError()`:

| Error | User Message |
|-------|--------------|
| insufficient balance | Insufficient token balance |
| insufficient allowance | Insufficient allowance approved |
| allowance would overflow | Allowance amount is too large |
| account is frozen | Account is frozen and cannot perform transfers |
| not initialized | Contract is not initialized |

## Data Flow Diagram

```
User Input (Form)
        ↓
  Form Validation (zod)
        ↓
  Pre-flight Check (simulator)
        ↓
  Display Check Results
        ↓
  User Confirms
        ↓
  Build Transaction
        ↓
  Sign with Freighter
        ↓
  Submit to RPC
        ↓
  Poll for Completion
        ↓
  Display Success/Hash
```

## Usage Examples

### Basic Usage - Grant Allowance

```tsx
import { ApproveForm } from "@/components/forms/ApproveForm";

export function MyComponent() {
  return (
    <ApproveForm
      onSuccess={(txHash) => console.log("Approved!", txHash)}
      onError={(error) => console.error("Error:", error)}
    />
  );
}
```

### With State Management - View Allowances

```tsx
import { AllowancesList } from "@/components/ui/AllowancesList";
import { useState, useEffect } from "react";

export function MyComponent() {
  const [allowances, setAllowances] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadAllowances();
  }, []);

  return (
    <AllowancesList
      allowances={allowances}
      isLoading={loading}
      onRevoke={handleRevoke}
      onRefresh={loadAllowances}
    />
  );
}
```

### Full Integration - Allowances Page

```tsx
import { AllowancesPage } from "@/app/dashboard/allowances/AllowancesPage";

// Add to routes or dashboard
export default function AllowancesRoute() {
  return <AllowancesPage />;
}
```

## Testing Checklist

- [ ] Form validation works (invalid addresses rejected)
- [ ] Pre-flight checks pass for valid inputs
- [ ] Pre-flight checks fail appropriately for invalid amounts
- [ ] Error messages are user-friendly
- [ ] Success messages display transaction hash
- [ ] Tabs switch between Grant/Revoke/Spend/View
- [ ] Allowance list displays correctly
- [ ] Revoke confirmation dialog works
- [ ] Expired allowances are marked and can be filtered
- [ ] Responsive design works on mobile

## Future Enhancements

1. **RPC Integration for fetching allowances** - Implement actual chain queries
2. **Batch operations** - Revoke multiple allowances at once
3. **Allowance templates** - Common allowance amounts (like dai.js)
4. **Notifications** - Toast notifications for success/failure
5. **Allowance history** - Show past approvals and revocations
6. **Alert for high allowances** - Warn if user grants very large allowances
7. **Spender reputation** - Show info about frequently used spender addresses

## Security Considerations

1. **Always show confirmation for revoke** - Prevents accidental revocation
2. **Warn on high allowances** - Let users know if they're approving large amounts
3. **Clear expiration display** - Users should understand when allowances expire
4. **Show truncated addresses** - Full addresses when copying/clicking
5. **Network warning** - Clearly indicate mainnet vs. testnet
6. **Validate all addresses** - Use regex to catch invalid formats early

## Related Documentation

- [Transaction Pre-flight Checks](./transaction-simulator-implementation.md)
- [Token Contract Reference](../contracts/token/)
- [Soroban SEP-41 Standard](https://github.com/stellar/protocol/blob/master/core/cap-0046-01.md)
