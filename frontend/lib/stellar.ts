import * as StellarSdk from "@stellar/stellar-sdk";

// ---------------------------------------------------------------------------
// Config — defaults to Stellar Testnet
// ---------------------------------------------------------------------------
const HORIZON_URL =
  process.env.NEXT_PUBLIC_HORIZON_URL ?? "https://horizon-testnet.stellar.org";
const SOROBAN_RPC_URL =
  process.env.NEXT_PUBLIC_SOROBAN_RPC_URL ??
  "https://soroban-testnet.stellar.org";
const NETWORK_PASSPHRASE =
  process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE ?? StellarSdk.Networks.TESTNET;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface TokenInfo {
  name: string;
  symbol: string;
  decimals: number;
  totalSupply: string;
  circulatingSupply: string;
  admin: string;
  contractId: string;
}

export interface TokenHolder {
  address: string;
  balance: string;
  sharePercent: number;
}

export interface VestingScheduleInfo {
  recipient: string;
  totalAmount: string;
  cliffLedger: number;
  endLedger: number;
  released: string;
  revoked: boolean;
}

// ---------------------------------------------------------------------------
// Soroban RPC helpers
// ---------------------------------------------------------------------------
const rpc = new StellarSdk.rpc.Server(SOROBAN_RPC_URL);

/**
 * Simulate a read-only Soroban contract invocation and return the result xdr.
 */
async function simulateCall(
  contractId: string,
  method: string,
  args: StellarSdk.xdr.ScVal[] = [],
): Promise<StellarSdk.xdr.ScVal> {
  const contract = new StellarSdk.Contract(contractId);
  const account = new StellarSdk.Account(
    "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
    "0",
  );

  const tx = new StellarSdk.TransactionBuilder(account, {
    fee: "100",
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(30)
    .build();

  const sim = await rpc.simulateTransaction(tx);

  if (StellarSdk.rpc.Api.isSimulationError(sim)) {
    throw new Error(`Soroban simulation error (${method}): ${sim.error}`);
  }

  if (!StellarSdk.rpc.Api.isSimulationSuccess(sim) || !sim.result) {
    throw new Error(`Soroban simulation failed for ${method}`);
  }

  return sim.result.retval;
}

/** Decode an ScVal string (symbol or string type). */
function decodeString(val: StellarSdk.xdr.ScVal): string {
  switch (val.switch()) {
    case StellarSdk.xdr.ScValType.scvSymbol():
      return val.sym().toString();
    case StellarSdk.xdr.ScValType.scvString():
      return val.str().toString();
    default:
      return val.value()?.toString() ?? "";
  }
}

/** Decode an ScVal 128-bit integer to a bigint string. */
function decodeI128(val: StellarSdk.xdr.ScVal): string {
  const parts = val.i128();
  const hi = BigInt(parts.hi().toString());
  const lo = BigInt(parts.lo().toString());
  return ((hi << BigInt(64)) + lo).toString();
}

/** Decode an ScVal u32. */
function decodeU32(val: StellarSdk.xdr.ScVal): number {
  return val.u32();
}

/** Decode an ScVal address to a string. */
function decodeAddress(val: StellarSdk.xdr.ScVal): string {
  return StellarSdk.Address.fromScVal(val).toString();
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetch full token metadata from a Soroban SEP-41 token contract.
 */
export async function fetchTokenInfo(contractId: string): Promise<TokenInfo> {
  const [nameVal, symbolVal, decimalsVal, adminVal] = await Promise.all([
    simulateCall(contractId, "name"),
    simulateCall(contractId, "symbol"),
    simulateCall(contractId, "decimals"),
    simulateCall(contractId, "admin").catch(() => null),
  ]);

  const decimals = decodeU32(decimalsVal);

  // total_supply is not part of SEP-41 but many tokens implement it;
  // fall back to "N/A" when unavailable.
  let totalSupply = "N/A";
  let circulatingSupply = "N/A";
  try {
    const supplyVal = await simulateCall(contractId, "total_supply");
    const rawSupply = decodeI128(supplyVal);
    totalSupply = formatTokenAmount(rawSupply, decimals);
    // For Soroban tokens, circulating supply == total supply unless a
    // treasury/burn mechanism is in place. Show the same value here;
    // downstream dashboards can customise.
    circulatingSupply = totalSupply;
  } catch {
    // total_supply not implemented on this contract
  }

  return {
    name: decodeString(nameVal),
    symbol: decodeString(symbolVal),
    decimals,
    totalSupply,
    circulatingSupply,
    admin: adminVal ? decodeAddress(adminVal) : "N/A",
    contractId,
  };
}

/**
 * Fetch the top token holders by querying Horizon for accounts that hold
 * the given classic asset **or** by reading Soroban contract storage.
 *
 * Because Soroban tokens don't expose a native "list holders" method, we
 * query Horizon for the corresponding classic-wrapped asset first. If that
 * returns no results we return an empty list — a production indexer would
 * be needed for full Soroban-native holder enumeration.
 */
export async function fetchTopHolders(
  contractId: string,
  _symbol?: string,
  _issuer?: string,
  limit = 10,
): Promise<TokenHolder[]> {
  try {
    // Attempt to read ledger entries for known holder patterns.
    // For a real product, this would use a Soroban indexer (e.g. Mercury).
    // As a best-effort fallback, we query Horizon for the classic asset.
    const horizon = new StellarSdk.Horizon.Server(HORIZON_URL);

    if (_symbol && _issuer) {
      const asset = new StellarSdk.Asset(_symbol, _issuer);
      const { records } = await horizon
        .accounts()
        .forAsset(asset)
        .limit(limit)
        .order("desc")
        .call();

      // Calculate total for percentage
      let total = BigInt(0);
      const parsed = records.map((acc) => {
        const bal = acc.balances.find(
          (b) =>
            "asset_code" in b &&
            b.asset_code === _symbol &&
            "asset_issuer" in b &&
            b.asset_issuer === _issuer,
        );
        const raw = BigInt(
          Math.round(parseFloat(bal ? bal.balance : "0") * 1e7),
        );
        total += raw;
        return { address: acc.account_id, rawBalance: raw };
      });

      return parsed.map(({ address, rawBalance }) => ({
        address,
        balance: (Number(rawBalance) / 1e7).toFixed(7),
        sharePercent:
          total > BigInt(0)
            ? Number((rawBalance * BigInt(10000)) / total) / 100
            : 0,
      }));
    }

    return [];
  } catch {
    // Horizon query may fail for Soroban-only tokens — expected.
    return [];
  }
}

// ---------------------------------------------------------------------------
// Vesting helpers
// ---------------------------------------------------------------------------

/** Extract a named field from a Soroban struct (ScVal map). */
function getStructField(
  entries: StellarSdk.xdr.ScMapEntry[],
  name: string,
): StellarSdk.xdr.ScVal {
  const entry = entries.find((e) => decodeString(e.key()) === name);
  if (!entry) throw new Error(`Missing struct field: ${name}`);
  return entry.val();
}

/**
 * Fetch the current ledger sequence number from Soroban RPC.
 */
export async function fetchCurrentLedger(): Promise<number> {
  const result = await rpc.getLatestLedger();
  return result.sequence;
}

/**
 * Fetch a vesting schedule from a Soroban vesting contract.
 */
export async function fetchVestingSchedule(
  vestingContractId: string,
  recipient: string,
): Promise<VestingScheduleInfo> {
  const recipientScVal = new StellarSdk.Address(recipient).toScVal();
  const result = await simulateCall(vestingContractId, "get_schedule", [
    recipientScVal,
  ]);

  const fields = result.map()!;
  return {
    recipient: decodeAddress(getStructField(fields, "recipient")),
    totalAmount: decodeI128(getStructField(fields, "total_amount")),
    cliffLedger: decodeU32(getStructField(fields, "cliff_ledger")),
    endLedger: decodeU32(getStructField(fields, "end_ledger")),
    released: decodeI128(getStructField(fields, "released")),
    revoked: getStructField(fields, "revoked").b(),
  };
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

/** Format a raw integer token amount using the given decimals. */
export function formatTokenAmount(raw: string, decimals: number): string {
  if (raw === "N/A") return raw;
  const num = BigInt(raw);
  const divisor = BigInt(10) ** BigInt(decimals);
  const whole = num / divisor;
  const frac = num % divisor;

  if (frac === BigInt(0)) return whole.toLocaleString();

  const fracStr = frac.toString().padStart(decimals, "0").replace(/0+$/, "");
  return `${whole.toLocaleString()}.${fracStr}`;
}

/** Truncate a Stellar address for display: G...XXXX */
export function truncateAddress(addr: string, chars = 4): string {
  if (addr.length <= chars * 2 + 3) return addr;
  return `${addr.slice(0, chars + 1)}...${addr.slice(-chars)}`;
}

// ---------------------------------------------------------------------------
// Transaction building and submission
// ---------------------------------------------------------------------------

/**
 * Build a transaction XDR for revoking a vesting schedule.
 * Returns the unsigned transaction XDR string.
 */
export async function buildRevokeTransaction(
  vestingContractId: string,
  recipientAddress: string,
  sourcePublicKey: string,
): Promise<string> {
  const contract = new StellarSdk.Contract(vestingContractId);
  const recipientScVal = new StellarSdk.Address(recipientAddress).toScVal();

  // Get source account
  const horizon = new StellarSdk.Horizon.Server(HORIZON_URL);
  const sourceAccount = await horizon.loadAccount(sourcePublicKey);

  // Build transaction
  const tx = new StellarSdk.TransactionBuilder(sourceAccount, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call("revoke", recipientScVal))
    .setTimeout(30)
    .build();

  // Simulate to get resource fees
  const simulated = await rpc.simulateTransaction(tx);

  if (StellarSdk.rpc.Api.isSimulationError(simulated)) {
    throw new Error(`Simulation failed: ${simulated.error}`);
  }

  if (!StellarSdk.rpc.Api.isSimulationSuccess(simulated)) {
    throw new Error("Transaction simulation was not successful");
  }

  // Assemble the transaction with simulation results
  const assembled = StellarSdk.rpc.assembleTransaction(tx, simulated);

  return assembled.build().toXDR();
}

/**
 * Submit a signed transaction XDR to the network.
 * Returns the transaction hash on success.
 */
export async function submitTransaction(signedXdr: string): Promise<string> {
  const tx = StellarSdk.TransactionBuilder.fromXDR(
    signedXdr,
    NETWORK_PASSPHRASE,
  );

  const result = await rpc.sendTransaction(tx as StellarSdk.Transaction);

  if (result.status === "ERROR") {
    throw new Error(
      `Transaction failed: ${result.errorResult?.toXDR("base64")}`,
    );
  }

  // Poll for transaction result
  let getResponse = await rpc.getTransaction(result.hash);
  let attempts = 0;
  const maxAttempts = 30;

  while (getResponse.status === "NOT_FOUND" && attempts < maxAttempts) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    getResponse = await rpc.getTransaction(result.hash);
    attempts++;
  }

  if (getResponse.status === "NOT_FOUND") {
    throw new Error("Transaction not found after polling");
  }

  if (getResponse.status === "FAILED") {
    throw new Error(
      `Transaction failed: ${getResponse.resultXdr?.toXDR("base64")}`,
    );
  }

  return result.hash;
}
