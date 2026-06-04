# Token Contract `permit()` Function Removal Notice

## Summary

The `permit()` function has been **removed** from the token contract in this release. This function previously accepted an off-chain signature parameter but did not verify it, instead falling back to standard on-chain authorization via `owner.require_auth()`.

## Why Was It Removed?

### 1. **Deception Vulnerability**
The function signature implied EIP-2612-style gasless permit functionality, but the implementation:
- Accepted a `signature: BytesN<64>` parameter that was completely ignored
- Required the owner to authorize the transaction on-chain (defeating the purpose of off-chain signatures)
- Provided no actual benefit over the standard `approve()` function

Any integrator or relayer reading the function signature would reasonably assume it provided gasless authorization, leading to incorrect integration and potential security misunderstandings.

### 2. **Technical Limitation**
The Soroban SDK (version 21.0.0) does not provide a mechanism to extract Ed25519 public key bytes from an `Address` type within a contract context. Without access to the public key, it is impossible to verify signatures using `env.crypto().ed25519_verify()`.

The `Address` type is opaque and does not expose methods to retrieve the underlying public key, making proper signature verification impossible at this time.

### 3. **Clean Codebase**
Removing the non-functional stub:
- Eliminates misleading API surface
- Removes unused nonce storage infrastructure
- Prevents incorrect integrations based on false assumptions
- Makes the contract's actual capabilities clear

## What Should You Use Instead?

Use the standard **`approve()`** function for allowance management:

```rust
pub fn approve(
    env: Env,
    from: Address,
    spender: Address,
    amount: i128,
    expiration_ledger: u32,
)
```

This function:
- Requires on-chain authorization from the owner (`from.require_auth()`)
- Sets an allowance for the spender
- Manages TTL based on the expiration_ledger parameter
- Is fully functional and secure

## When Will `permit()` Return?

The `permit()` function will be re-implemented in a future release when one of the following conditions is met:

### Option 1: SDK Support for Public Key Extraction
When the Soroban SDK adds support for extracting Ed25519 public keys from `Address` types, proper signature verification can be implemented.

### Option 2: Alternative Signature Verification Mechanism
If the Soroban platform provides an alternative mechanism for verifying signatures against addresses without direct public key access.

## Future Implementation Specification

When `permit()` is re-implemented, it will follow this specification:

### Message Construction
```rust
message = sha256(
    b"soropad_token_permit_v1" ||  // domain separator
    contract_address ||
    owner_address ||
    spender_address ||
    amount.to_le_bytes() ||
    expiration_ledger.to_le_bytes() ||
    nonce.to_le_bytes()
)
```

### Implementation Requirements
1. Extract owner's Ed25519 public key from `Address`
2. Verify signature: `env.crypto().ed25519_verify(&public_key, &message, &signature)`
3. Validate nonce (replay protection)
4. Validate expiration_ledger
5. **No `owner.require_auth()` call** — signature verification replaces on-chain auth
6. Set allowance on successful verification

### Security Properties
- **Gasless**: Owner signs off-chain; relayer or spender submits transaction
- **Replay protection**: Nonces prevent signature reuse
- **Expiration**: Time-bound permits prevent indefinite validity
- **Domain separation**: Prevents cross-contract signature replay

## Migration Guide

### If You Were Using `permit()`

Since the previous implementation required `owner.require_auth()`, it was functionally identical to `approve()`. Simply replace all `permit()` calls with `approve()` calls:

**Before:**
```rust
token.permit(
    &owner,
    &spender,
    &amount,
    &expiration_ledger,
    &nonce,
    &signature,  // This was ignored anyway
);
```

**After:**
```rust
token.approve(
    &owner,
    &spender,
    &amount,
    &expiration_ledger,
);
```

No functional change — both require on-chain authorization from the owner.

### If You Were Planning to Use `permit()`

Wait for a future release that implements proper signature verification. Monitor the Soroban SDK releases for public key extraction support.

## Related Changes

The following items were also removed as they were only used by the non-functional `permit()` implementation:

- `DataKey::Nonce(Address)` — nonce storage key
- `nonce(env: Env, owner: Address) -> u64` — nonce getter function
- All permit-related tests:
  - `test_permit_functionality()`
  - `test_permit_nonce_validation()`
  - `test_permit_invalid_nonce()`

## Questions?

For questions or concerns about this change, please open an issue on the repository.

---

**Removed in:** [This PR]  
**Reason:** Deception vulnerability + SDK limitation  
**Status:** Will be re-implemented when SDK supports public key extraction from Address types
