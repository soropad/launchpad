# Approach Statement for Issue #216: Token Contract permit() Implementation


## Resolution Path: **Remove permit() Entirely (PATH B)**

### Justification

After completing the mandatory codebase reconnaissance, I have determined that **removal** is the only safe and correct resolution path for the following reasons:


#### 1. **Critical Technical Blocker**
The Soroban SDK 21.0.0 does not provide a mechanism to extract the Ed25519 public key bytes from an `Address` type within a contract context. The `Address` type is opaque and does not expose methods like `to_public_key()` or similar. Without access to the public key, it is impossible to call `env.crypto().ed25519_verify(&public_key, &message, &signature)`.

**Evidence:**
- Reviewed Soroban SDK documentation and example contracts (simple-account, complex-account)
- The example contracts receive public keys as explicit `BytesN<32>` parameters during initialization
- No SDK method exists to derive public key bytes from an `Address` representing an account


#### 2. **Current State is a Deception Vulnerability**
The current `permit()` function:
- Accepts a `_signature: BytesN<64>` parameter (note the underscore prefix indicating it's unused)
- **Completely ignores the signature**
- Falls back to `owner.require_auth()` — making it functionally identical to `approve()`
- Provides a false sense of security to any integrator who assumes EIP-2612-style gasless authorization

**Severity Classification:** This is a **deception vulnerability**. Any relayer or integrator reading the function signature would reasonably assume it provides gasless permit functionality, but it actually requires the owner to authorize the transaction on-chain, defeating the entire purpose.

#### 3. **Maintainer Intent**
From NEW_ISSUES.md (Issue #1), the feature is described as:
> "Introduce a `permit` function allowing users to sign an off-chain authorization (similar to EIP-2612). A relayer or spender can submit this signature with the transaction to instantly gain allowance logic without an upfront on-chain approval."

The current implementation does **not** fulfill this requirement. It is a stub that was never completed.

#### 4. **No Dependency Risk**
- No other contracts in the workspace reference `permit()`
- The function is not part of any required SEP standard for this token
- Removal will not break any existing integrations (since the function doesn't work as advertised anyway)

### Files to be Modified

1. **contracts/token/src/lib.rs**
   - Remove the entire `permit()` function (lines 438-500)
   - Remove the `nonce()` getter function (lines 502-506) — only used by permit
   - Remove `DataKey::Nonce(Address)` variant (line 18) — only used by permit
   - Keep all other functionality intact

2. **contracts/token/src/lib.rs** (tests section)
   - Delete `test_permit_functionality()` (lines 1242-1275)
   - Delete `test_permit_nonce_validation()` (lines 1277-1303)
   - Delete `test_permit_invalid_nonce()` (lines 1305-1327)

3. **Documentation**
   - Add removal notice to README.md explaining why permit was removed and when it might return

### What Will NOT Change

- All other token contract functions remain unchanged
- The `approve()` function continues to work as the standard approval mechanism
- All existing tests for other functionality will continue to pass
- No changes to the vesting contract (issue #215 is separate)

### Security Invariants Confirmed

**Current State:**
- **Deception vulnerability**: Function signature implies gasless authorization but requires on-chain auth
- **Nonce storage waste**: Nonces are stored and incremented but serve no security purpose
- **Misleading tests**: Tests pass zero-byte signatures and claim to test "functionality"

**Post-Removal State:**
- **No false promises**: Function removed, no misleading API surface
- **Clean codebase**: No unused nonce storage or stub implementations
- **Clear documentation**: Removal notice explains the situation and future plans

### CI Checks to Pass

Based on `.github/workflows/ci.yml`:

1. ✅ `cargo fmt --all -- --check` — formatting
2. ✅ `cargo test --workspace` — all tests pass (after removing permit tests)
3. ✅ `cargo build --target wasm32-unknown-unknown --release` — WASM builds successfully
4. ✅ WASM size delta: Expected **decrease** due to removal of unused code

### Conflict Avoidance

- **Branch**: Will create new branch from latest `master`
- **Issue #215**: Modifies `contracts/vesting/src/lib.rs` — no file overlap with this change
- **Commit message**: `fix(token): remove non-functional permit() to eliminate deception vulnerability (#216)`

### Future Implementation Path

When the Soroban SDK adds support for extracting Ed25519 public keys from `Address` types (or provides an alternative signature verification mechanism for addresses), `permit()` can be properly implemented following this specification:

**Message Construction:**
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

**Implementation Requirements:**
1. Extract owner's Ed25519 public key from `Address`
2. Verify signature: `env.crypto().ed25519_verify(&public_key, &message, &signature)`
3. Validate nonce (replay protection)
4. Validate expiration_ledger
5. **Remove** `owner.require_auth()` call
6. Set allowance on successful verification

### Unresolved Questions

None. The resolution path is clear: removal is the only safe option given the SDK limitations.

---

**Proceeding with PATH B: Complete removal of permit() and related infrastructure.**
