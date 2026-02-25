# Token Allowance Management - Integration Guide

## Overview

The token allowance management system provides a complete UI for managing SEP-41 token allowances on Soroban. Users can:

- **Grant allowances** to spender addresses
- **Revoke allowances** to remove permissions
- **Transfer from** using allowances granted to them
- **View active allowances** with expiration information

## Architecture

### Components

#### 1. **AllowanceManager** (`components/AllowanceManager.tsx`)
Main interface with tabbed navigation for all allowance operations.

```tsx
import { AllowanceManager } from "@/components/AllowanceManager";

export default function Page() {
  return <AllowanceManager />;
}
```

#### 2. **ApproveForm** (`components/forms/ApproveForm.tsx`)
Form for granting allowances with pre-flight checks.

```tsx
import { ApproveForm } from "@/components/forms/ApproveForm";

export function MyComponent() {
  const handleSuccess = (txHash: string) => {
    console.log("Allowance granted:", txHash);
  };

  return <ApproveForm onSuccess={handleSuccess} onError={(e) => console.error(e)} />;
}
```

#### 3. **RevokeAllowanceForm** (`components/forms/RevokeAllowanceForm.tsx`)
Form for revoking allowances with confirmation.

```tsx
import { RevokeAllowanceForm } from "@/components/forms/RevokeAllowanceForm";

export function MyComponent() {
  return <RevokeAllowanceForm onSuccess={handleSuccess} />;
}
```

#### 4. **TransferFromForm** (`components/forms/TransferFromForm.tsx`)
Form for transferring tokens using granted allowances.

```tsx
import { TransferFromForm } from "@/components/forms/TransferFromForm";

export function MyComponent() {
  return <TransferFromForm onSuccess={handleSuccess} />;
}
```

#### 5. **AllowanceList** (`components/AllowanceList.tsx`)
Display and manage active allowances for a token.

```tsx
import { AllowanceList } from "@/components/AllowanceList";

const mockAllowances = [
  {
    id: "1",
    tokenContractId: "C...",
    spenderAddress: "G...",
    amount: "1000.00",
    expirationLedger: 1000000,
    isExpired: false,
  },
];

export function MyComponent() {
  return (
    <AllowanceList
      allowances={mockAllowances}
      onRevoke={async (id) => console.log("Revoke:", id)}
    />
  );
}
```

### Hooks

#### `useTransactionSimulator()`
Provides pre-flight check methods for allowance operations.

```tsx
import { useTransactionSimulator } from "@/hooks/useTransactionSimulator";

export function MyComponent() {
  const simulator = useTransactionSimulator();

  // Check approve operation
  const result = await simulator.checkApprove(
    contractId,
    ownerAddress,
    spenderAddress,
    amount,
    expirationLedger
  );

  // Check revoke operation
  const result = await simulator.checkRevokeAllowance(
    contractId,
    ownerAddress,
    spenderAddress
  );

  // Check transfer_from operation
  const result = await simulator.checkTransferFrom(
    contractId,
    spenderAddress,
    fromAddress,
    toAddress,
    amount
  );
}
```

## Integration Points

### 1. Dashboard Integration

Add allowance management to the token dashboard:

```tsx
// app/dashboard/[contractId]/TokenDashboard.tsx

import { AllowanceManager } from "@/components/AllowanceManager";
import { AllowanceList } from "@/components/AllowanceList";

export default function TokenDashboard({ contractId }: { contractId: string }) {
  const [activeTab, setActiveTab] = useState<"overview" | "allowances">("overview");

  return (
    <div>
      {/* Existing dashboard content */}
      {activeTab === "overview" && <YourExistingContent />}

      {activeTab === "allowances" && <AllowanceManager />}

      {/* Tab navigation */}
      <nav>
        <button onClick={() => setActiveTab("overview")}>Overview</button>
        <button onClick={() => setActiveTab("allowances")}>Allowances</button>
      </nav>
    </div>
  );
}
```

### 2. Sidebar Navigation

Add allowance manager to the dashboard sidebar:

```tsx
// app/components/Navbar.tsx

<Link href="/allowances" className="nav-link">
  Token Allowances
</Link>
```

### 3. Admin Panel Integration

Integrate with existing AdminPanel for token operations:

```tsx
// app/dashboard/[contractId]/components/AdminPanel.tsx

import { AllowanceManager } from "@/components/AllowanceManager";

export function AdminPanel({ contractId }: AdminPanelProps) {
  const [showAllowances, setShowAllowances] = useState(false);

  return (
    <div>
      {/* Existing admin operations */}
      <div className="space-y-6">
        {/* Mint, Burn, Transfer operations */}
      </div>

      {showAllowances && <AllowanceManager />}

      <button onClick={() => setShowAllowances(!showAllowances)}>
        {showAllowances ? "Hide" : "Show"} Allowance Manager
      </button>
    </div>
  );
}
```

## Pre-flight Checks

All forms include transaction pre-flight checks powered by `useTransactionSimulator`:

### Error Messages

The following errors are automatically handled with user-friendly messages:

- `insufficient allowance` → "Insufficient allowance approved for the spender."
- `allowance would overflow` → "Allowance amount is too large and would overflow."
- `approval would exceed max_supply` → "Approval amount cannot exceed the token's maximum supply."

### Adding Custom Errors

To add more error mappings:

```tsx
// frontend/lib/transactionSimulator.ts

const ERROR_MESSAGE_MAP: Record<string, string> = {
  "your error pattern": "User-friendly message",
};
```

## Transaction Flow

### Approve Flow

```
User fills ApproveForm
    ↓
Validates inputs (schema)
    ↓
Runs pre-flight check via simulator
    ↓
Shows errors/warnings or enables submit
    ↓
User signs transaction with Freighter
    ↓
Transaction submitted to RPC
    ↓
Success notification with TX hash
```

### Revoke Flow

```
User fills RevokeAllowanceForm
    ↓
Validates inputs
    ↓
Runs pre-flight check
    ↓
Shows confirmation dialog
    ↓
User confirms revocation
    ↓
User signs transaction
    ↓
Allowance set to 0 (revoked)
    ↓
Success notification
```

### Transfer From Flow

```
User fills TransferFromForm
    ↓
Validates source, recipient, amount
    ↓
Runs pre-flight check
    ↓
Shows errors or enables submit
    ↓
User signs as spender
    ↓
Transfers on behalf of source
    ↓
Success notification
```

## API Integration

### Fetching Current Allowances

To fetch active allowances from a contract, add a query function:

```tsx
// frontend/lib/soroban.ts

export async function getAllowances(
  contractId: string,
  ownerAddress: string,
  rpcUrl: string
): Promise<Array<{ spender: string; amount: bigint; expiration: number }>> {
  const rpc = new StellarSdk.rpc.Server(rpcUrl);
  const contract = new StellarSdk.Contract(contractId);

  // This requires a contract method to enumerate allowances
  // If not available, maintain a local list
  // Example: query from contract state or maintain off-chain index
}
```

### Contract Methods Used

#### `approve(from, spender, amount, expiration_ledger)`
Grants an allowance to a spender.

```tsx
const args = [
  new StellarSdk.Address(ownerAddress).toScVal(),
  new StellarSdk.Address(spenderAddress).toScVal(),
  StellarSdk.nativeToScVal(BigInt(amount), { type: "i128" }),
  StellarSdk.nativeToScVal(BigInt(expirationLedger), { type: "u32" }),
];

const result = await simulateApprove(contractId, ownerAddress, spenderAddress, amount);
```

#### `revoke(from, spender)` (alias: approve with 0 amount)
Revokes an allowance.

```tsx
const result = await simulator.checkRevokeAllowance(
  contractId,
  ownerAddress,
  spenderAddress
);
```

#### `transfer_from(spender, from, to, amount)`
Transfers on behalf of another address.

```tsx
const result = await simulator.checkTransferFrom(
  contractId,
  spenderAddress,
  fromAddress,
  toAddress,
  amount
);
```

#### `allowance(from, spender) → i128`
Query current allowance amount.

```tsx
// This would require a contract call to read
// Currently not exposed in the simulator
```

## Testing

Run tests with:

```bash
npm test allowanceForm.test.tsx
npm test allowanceManager.test.tsx
```

### Test Coverage

- ✅ Form validation
- ✅ Pre-flight checks
- ✅ Error handling
- ✅ Success notifications
- ✅ Tab navigation
- ✅ Allowance list rendering
- ✅ Revoke confirmation
- ✅ Copy to clipboard

## Configuration

### Network Configuration

The system uses the network configuration from `NetworkProvider`:

```tsx
// app/providers/NetworkProvider.tsx

interface NetworkConfig {
  rpcUrl: string;
  passphrase: string;
  network: "mainnet" | "testnet" | "futurenet";
}
```

### Allowance Defaults

- Default expiration: 365 days (~10.8 seconds per ledger)
- Decimal precision: 7 (matches SEP-41)

Customize in form components:

```tsx
// Adjust default expiration days in ApproveForm
const expirationDays = formData.expirationDays || "365";
const ledger = 1000000 + parseInt(expirationDays) * 10800;
```

## Security Considerations

### Pre-flight Checks

All operations run pre-flight checks before signing to catch errors early:
- Insufficient balance
- Invalid addresses
- Allowance overflow
- Contract not initialized

### Revoke Confirmation

Revocation requires explicit user confirmation to prevent accidents.

### Expiration

Allowances have expiration ledgers for security:
- Default: 365 days from transaction
- Maximum: Ledger 10,000,000+ (far future)

### Address Validation

All addresses are validated against SEP-5 standards:
- `G...` for Stellar accounts (56 chars)
- `C...` for contracts (56 chars)

## Troubleshooting

### "Invalid Stellar public key"
- Ensure spender address is a valid Stellar account (G...)
- Use testnet addresses for testnet contracts

### "Insufficient allowance"
- Check if enough allowance is granted
- Verify spender address matches

### "Contract invocation failed"
- Verify contract is initialized
- Check contract implements SEP-41 approve/transfer_from

### Pre-flight checks always fail
- Ensure network configuration is correct
- Verify RPC URL is accessible
- Check contract address format (C...)

## Future Enhancements

- [ ] Batch operations (approve multiple spenders)
- [ ] Allowance expiration countdown timer
- [ ] Allowance increase/decrease helpers
- [ ] Allowance suggestions based on token metadata
- [ ] Allowance limits enforcement
- [ ] Historical allowance changes log
- [ ] Allowance analytics dashboard

## Additional Resources

- [SEP-41: Soroban Token Standard](https://stellar.org/protocol/sep-0041)
- [Soroban Smart Contracts](https://soroban.stellar.org/)
- [Soroban JavaScript SDK](https://github.com/stellar/js-stellar-sdk)
