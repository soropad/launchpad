# Revoke Button Security Documentation

## Overview

The Revoke button feature allows administrators to revoke vesting schedules, reclaiming unvested tokens while ensuring vested tokens are transferred to recipients. This document outlines the security measures implemented to protect against common vulnerabilities.

## Security Measures

### 1. Admin-Only Access Control

**Implementation:**

- The revoke function in the smart contract uses `require_auth()` to verify the caller is the admin
- Frontend checks wallet connection before allowing revoke action
- Transaction signing happens exclusively through Freighter wallet (no private keys in frontend)

**Protection Against:**

- Unauthorized revocation attempts
- Privilege escalation attacks

**Code Reference:**

```rust
// contracts/vesting/src/lib.rs
fn _require_admin(env: &Env) {
    let admin: Address = env
        .storage()
        .instance()
        .get(&DataKey::Admin)
        .expect("not initialized");
    admin.require_auth();
}
```

### 2. Confirmation Dialog

**Implementation:**

- User must explicitly confirm the revoke action before transaction is built
- Dialog clearly states the action is irreversible
- Shows recipient address to prevent mistakes
- Requires two clicks: "Revoke Schedule" button + "Revoke" confirmation

**Protection Against:**

- Accidental revocations
- UI clickjacking (user must interact with modal)
- Social engineering (clear warning about consequences)

**Best Practices Applied:**

- Based on [Nielsen Norman Group guidelines](https://www.nngroup.com/articles/confirmation-dialog/) for confirmation dialogs
- Follows blockchain transaction UX patterns from DeFi applications

### 3. Transaction Signing Security

**Implementation:**

- All transaction signing happens in Freighter wallet extension
- Private keys never touch the frontend application
- XDR is built client-side and sent to Freighter for signing
- Network passphrase validation ensures correct network

**Protection Against:**

- Private key exposure
- Man-in-the-middle attacks on signing
- Cross-network replay attacks

**Code Reference:**

```typescript
// frontend/lib/stellar.ts
const signedXdr = await signTransaction(xdr, {
  networkPassphrase: process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE,
});
```

### 4. Input Validation

**Implementation:**

- Contract ID and recipient address validated before transaction building
- Stellar SDK validates address formats
- Contract simulation runs before signing to catch errors early

**Protection Against:**

- Invalid address attacks
- Malformed transaction submissions
- Gas estimation failures

### 5. Reentrancy Protection

**Implementation:**

- Smart contract uses single-phase state updates
- Schedule marked as revoked before token transfers
- No external calls before state changes

**Protection Against:**

- Reentrancy attacks
- Double-revocation attempts

**Code Reference:**

```rust
// contracts/vesting/src/lib.rs
schedule.revoked = true;
schedule.released = vested;
env.storage().persistent().set(&key, &schedule);
// Only after state update do we transfer tokens
```

### 6. Error Handling

**Implementation:**

- Comprehensive error messages for all failure scenarios
- User-friendly error display (no raw error dumps)
- Transaction failures logged for debugging
- Graceful degradation on network issues

**Protection Against:**

- Information leakage through error messages
- User confusion leading to repeated failed attempts
- Unhandled exceptions

### 7. Rate Limiting & DoS Prevention

**Implementation:**

- Transaction submission uses Stellar network's built-in rate limiting
- UI disables button during transaction processing
- Loading states prevent double-submission

**Protection Against:**

- Denial of service through transaction spam
- Accidental double-revocation attempts
- Network congestion from repeated submissions

### 8. Frontend Security

**Implementation:**

- No sensitive data stored in localStorage/sessionStorage
- Environment variables for network configuration
- CSP headers recommended in production (Next.js default)
- No eval() or dangerous DOM manipulation

**Protection Against:**

- XSS attacks
- CSRF attacks
- Local storage poisoning

## Security Checklist

- [x] Admin authentication enforced at contract level
- [x] Confirmation dialog for destructive actions
- [x] Transaction signing via secure wallet (Freighter)
- [x] Input validation on all user inputs
- [x] Reentrancy protection in smart contract
- [x] Comprehensive error handling
- [x] Loading states to prevent double-submission
- [x] No private keys in frontend code
- [x] Network passphrase validation
- [x] State updates before external calls

## Known Limitations

1. **Frontend Admin Check**: The frontend does not verify if the connected wallet is the admin before showing the revoke button. This is intentional - the contract enforces admin-only access, and showing the button to all users provides better UX (clear error message if non-admin attempts revoke).

2. **Gas Estimation**: Transaction simulation may fail if the contract state changes between simulation and submission. Users should retry if this occurs.

3. **Network Dependency**: The feature requires a stable connection to Stellar RPC and Horizon. Network issues may cause transaction failures.

## Recommendations for Production

1. **Server-Side Validation**: Consider adding a backend API to validate admin status before allowing transaction building (defense in depth).

2. **Transaction Monitoring**: Implement monitoring for revoke transactions to detect unusual patterns.

3. **Audit Trail**: Consider emitting detailed events from the contract for off-chain audit logging.

4. **Multi-Sig Support**: For high-value vesting schedules, consider requiring multi-signature approval for revocations.

5. **Time Locks**: Consider adding a time delay between revoke initiation and execution for high-value schedules.

6. **Rate Limiting**: Implement application-level rate limiting for revoke attempts per wallet address.

## Testing

All security-critical paths are covered by automated tests:

- Unit tests for transaction building (`stellar.test.ts`)
- Component tests for confirmation dialog (`ConfirmDialog.test.tsx`)
- Integration tests for the full revoke flow
- Contract tests for admin authorization

Run tests with:

```bash
cd frontend
npm test
```

Target coverage: 95% for all affected files.

## Incident Response

If a security issue is discovered:

1. **Do not** disclose publicly until a fix is available
2. Contact the maintainers via security@example.com
3. Provide detailed reproduction steps
4. Allow 90 days for responsible disclosure

## References

- [Stellar Smart Contract Security Best Practices](https://developers.stellar.org/docs/smart-contracts/security)
- [OWASP Top 10 for Web Applications](https://owasp.org/www-project-top-ten/)
- [Smart Contract Security Verification Standard](https://github.com/securing/SCSVS)
- [Confirmation Dialog UX Best Practices](https://www.nngroup.com/articles/confirmation-dialog/)
