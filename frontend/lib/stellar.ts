import * as StellarSdk from "@stellar/stellar-sdk";
import { type NetworkConfig } from "../types/network";

// ---------------------------------------------------------------------------
// Config — defaults to Stellar Testnet, overridable via localStorage
// ---------------------------------------------------------------------------
const DEFAULT_HORIZON_URL =
  process.env.NEXT_PUBLIC_HORIZON_URL ?? "https://horizon-testnet.stellar.org";
const DEFAULT_SOROBAN_RPC_URL =
  process.env.NEXT_PUBLIC_SOROBAN_RPC_URL ??
  "https://soroban-testnet.stellar.org";
const NETWORK_PASSPHRASE =
  process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE ?? StellarSdk.Networks.TESTNET;

function getHorizonUrl(): string {
  if (typeof window !== "undefined") {
    return localStorage.getItem("soropad_horizon_url") || DEFAULT_HORIZON_URL;
  }
  return DEFAULT_HORIZON_URL;
}

function getRpcUrl(): string {
  if (typeof window !== "undefined") {
    return localStorage.getItem("soropad_rpc_url") || DEFAULT_SOROBAN_RPC_URL;
  }
  return DEFAULT_SOROBAN_RPC_URL;
}

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

export interface TokenAllowanceInfo {
  spenderAddress: string;
  amount: string;
  expirationLedger: number;
  isExpired: boolean;
}

// ---------------------------------------------------------------------------
// Soroban RPC helpers
// ---------------------------------------------------------------------------
function getRpc() {
  return new StellarSdk.rpc.Server(getRpcUrl());
}

async function simulateAndAssembleTransaction(tx: StellarSdk.Transaction) {
  const rpc = new StellarSdk.rpc.Server(getRpcUrl());
  const simulated = await rpc.simulateTransaction(tx);

  if (StellarSdk.rpc.Api.isSimulationError(simulated)) {
    throw new Error(`Simulation failed: ${simulated.error}`);
  }

  if (!StellarSdk.rpc.Api.isSimulationSuccess(simulated)) {
    throw new Error("Transaction simulation was not successful");
  }

  return StellarSdk.rpc.assembleTransaction(tx, simulated);
}

/**
 * Simulate a read-only Soroban contract invocation and return the result xdr.
 */
async function simulateCall(
  contractId: string,
  method: string,
  config: NetworkConfig,
  args: StellarSdk.xdr.ScVal[] = [],
): Promise<StellarSdk.xdr.ScVal> {
  const contract = new StellarSdk.Contract(contractId);
  const account = new StellarSdk.Account(
    "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
    "0",
  );

  const tx = new StellarSdk.TransactionBuilder(account, {
    fee: "100",
    networkPassphrase: config.passphrase,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(30)
    .build();

  const sim = await getRpc().simulateTransaction(tx);

  if (StellarSdk.rpc.Api.isSimulationError(sim)) {
    throw new Error(`Soroban simulation error (${method}): ${sim.error}`);
  }

  if (!StellarSdk.rpc.Api.isSimulationSuccess(sim) || !sim.result) {
    throw new Error(`Soroban simulation failed for ${method}`);
  }

  return sim.result.retval;
}

export async function fetchTokenAllowance(
  contractId: string,
  ownerAddress: string,
  spenderAddress: string,
  config: NetworkConfig,
): Promise<bigint> {
  const args = [
    new StellarSdk.Address(ownerAddress).toScVal(),
    new StellarSdk.Address(spenderAddress).toScVal(),
  ];
  const allowanceVal = await simulateCall(contractId, "allowance", config, args);
  return BigInt(decodeI128(allowanceVal));
}

export async function fetchApprovedSpendersFromEvents(params: {
  contractId: string;
  ownerAddress: string;
  maxPages?: number;
}): Promise<string[]> {
  const { contractId, ownerAddress, maxPages = 5 } = params;

  const rpc = new StellarSdk.rpc.Server(getRpcUrl());
  const spenders = new Set<string>();

  const getEvents = (rpc as unknown as { getEvents?: (req: unknown) => Promise<unknown> }).getEvents;
  if (!getEvents) {
    return [];
  }

  const readStringArray = (v: unknown): string[] | null => {
    if (!Array.isArray(v)) return null;
    if (!v.every((x) => typeof x === "string")) return null;
    return v as string[];
  };

  // NOTE: This is best-effort. Not all RPC nodes retain unlimited history.
  // We page a limited number of times to avoid expensive scans.
  let cursor: string | undefined;

  for (let page = 0; page < maxPages; page++) {
    const response = await getEvents({
      startLedger: 0,
      filters: [
        {
          type: "contract",
          contractIds: [contractId],
        },
      ],
      pagination: {
        limit: 200,
        cursor,
      },
    });

    const responseObj = (response ?? {}) as { events?: unknown; cursor?: unknown };
    const events = Array.isArray(responseObj.events) ? responseObj.events : [];
    if (events.length === 0) break;

    for (const e of events) {
      try {
        const eventObj = (e ?? {}) as { topic?: unknown };
        const topic = readStringArray(eventObj.topic) ?? [];
        if (topic.length < 3) continue;

        const topic0 = StellarSdk.xdr.ScVal.fromXDR(topic[0], "base64");
        const topic1 = StellarSdk.xdr.ScVal.fromXDR(topic[1], "base64");
        const topic2 = StellarSdk.xdr.ScVal.fromXDR(topic[2], "base64");

        const symbol = decodeString(topic0);
        if (symbol !== "approve") continue;

        const from = decodeAddress(topic1);
        const spender = decodeAddress(topic2);

        if (from === ownerAddress) {
          spenders.add(spender);
        }
      } catch {
        // ignore malformed events
      }
    }

    const nextCursor = typeof responseObj.cursor === "string" ? responseObj.cursor : undefined;
    if (!nextCursor || nextCursor === cursor) break;
    cursor = nextCursor;
  }

  return Array.from(spenders);
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
export async function fetchTokenInfo(
  contractId: string,
  config: NetworkConfig,
): Promise<TokenInfo> {
  const [nameVal, symbolVal, decimalsVal, adminVal] = await Promise.all([
    simulateCall(contractId, "name", config),
    simulateCall(contractId, "symbol", config),
    simulateCall(contractId, "decimals", config),
    simulateCall(contractId, "admin", config).catch(() => null),
  ]);

  const decimals = decodeU32(decimalsVal);

  let totalSupply = "N/A";
  let circulatingSupply = "N/A";
  try {
    const supplyVal = await simulateCall(contractId, "total_supply", config);
    const rawSupply = decodeI128(supplyVal);
    totalSupply = formatTokenAmount(rawSupply, decimals);
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
 * Fetch the top token holders.
 */
export async function fetchTopHolders(
  contractId: string,
  config: NetworkConfig,
  _symbol?: string,
  _issuer?: string,
  limit = 10,
): Promise<TokenHolder[]> {
  try {
    const horizon = new StellarSdk.Horizon.Server(config.horizonUrl);

    if (_symbol && _issuer) {
      const asset = new StellarSdk.Asset(_symbol, _issuer);
      const { records } = await horizon
        .accounts()
        .forAsset(asset)
        .limit(limit)
        .order("desc")
        .call();

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
    return [];
  }
}

// ---------------------------------------------------------------------------
// Vesting helpers
// ---------------------------------------------------------------------------

function getStructField(
  entries: StellarSdk.xdr.ScMapEntry[],
  name: string,
): StellarSdk.xdr.ScVal {
  const entry = entries.find((e) => decodeString(e.key()) === name);
  if (!entry) throw new Error(`Missing struct field: ${name}`);
  return entry.val();
}

/**
 * Fetch the current ledger sequence number.
 */
export async function fetchCurrentLedger(
  config: NetworkConfig,
): Promise<number> {
  const rpc = new StellarSdk.rpc.Server(config.rpcUrl);
  const result = await rpc.getLatestLedger();
  return result.sequence;
}

/**
 * Fetch a vesting schedule.
 */
export async function fetchVestingSchedule(
  vestingContractId: string,
  recipient: string,
  config: NetworkConfig,
): Promise<VestingScheduleInfo> {
  const recipientScVal = new StellarSdk.Address(recipient).toScVal();
  const result = await simulateCall(vestingContractId, "get_schedule", config, [
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

export interface TokenActivityInfo {
  id: string;
  pagingToken: string;
  type: "mint" | "transfer" | "burn" | "other";
  amount: string;
  from: string;
  to: string;
  timestamp: string;
  txHash: string;
}

/**
 * Fetch token activity operations for a given account or contract ID.
 * Parses classic `payment` and Soroban `invoke_host_function` operations.
 */
export async function fetchAccountOperations(
  accountId: string,
  cursor?: string,
  limit = 10,
): Promise<{ records: TokenActivityInfo[]; nextCursor: string | null }> {
  try {
    const horizon = new StellarSdk.Horizon.Server(getHorizonUrl());

    // Horizon's .forAccount() only accepts Ed25519 public keys (starting with G).
    // If the accountId is a contract ID (starting with C), we cannot query its operations this way.
    // In a production app, we would use an Indexer like Mercury for contract history.
    if (!accountId.startsWith("G") && !accountId.startsWith("M")) {
      return { records: [], nextCursor: null };
    }

    let callBuilder = horizon
      .operations()
      .forAccount(accountId)
      .limit(limit)
      .order("desc");
    if (cursor) {
      callBuilder = callBuilder.cursor(cursor);
    }

    const response = await callBuilder.call();

    // Extract paging token for the next page, from the last record fetched
    // (since order is desc, the last record in this array is the oldest).
    const nextCursor =
      response.records.length > 0
        ? response.records[response.records.length - 1].paging_token
        : null;

    const parsed: TokenActivityInfo[] = [];

    for (const record of response.records) {
      // Classic Native/Asset Payments
      if (record.type === "payment") {
        const r = record as unknown as Record<string, unknown>; // Horizon.ServerApi.PaymentOperationRecord
        // Native mints aren't strictly 'payment' but for asset payments:
        const isMint = r.from === r.asset_issuer;
        const isBurn = r.to === r.asset_issuer; // simplified burn heuristic
        let typeInfo: "mint" | "transfer" | "burn" = "transfer";
        if (isMint) typeInfo = "mint";
        else if (isBurn) typeInfo = "burn";

        parsed.push({
          id: record.id,
          pagingToken: record.paging_token,
          type: typeInfo,
          amount: typeof r.amount === "string" ? r.amount : "0",
          from: typeof r.from === "string" ? r.from : "Unknown",
          to: typeof r.to === "string" ? r.to : "Unknown",
          timestamp: record.created_at,
          txHash: record.transaction_hash,
        });
      }
      // Soroban Contract Invokes
      else if (record.type === "invoke_host_function") {
        const r = record as unknown as Record<string, unknown>;
        // Check for balance changes (requires Soroban RPC / Horizon with Soroban ingestion)
        // Note: Soroban Horizon responses might include `asset_balance_changes` if it was a token transfer
        const balChanges = r.asset_balance_changes;
        if (Array.isArray(balChanges) && balChanges.length > 0) {
          // Find the transfer or mint that is most relevant.
          // This is a simplified heuristic. We pick the first transfer for now.
          const transfer = balChanges.find((c: unknown) => {
            if (!c || typeof c !== "object") return false;
            const cast = c as Record<string, unknown>;
            return (
              cast.type === "transfer" ||
              cast.type === "mint" ||
              cast.type === "burn"
            );
          }) as Record<string, unknown> | undefined;

          if (transfer) {
            let actType: "mint" | "transfer" | "burn" = "transfer";
            if (transfer.from === r.source_account && transfer.type === "mint")
              actType = "mint"; // very rough heuristic, actual type is in transfer.type
            if (transfer.type === "mint" || transfer.type === "burn")
              actType = transfer.type as "mint" | "burn";

            parsed.push({
              id: record.id,
              pagingToken: record.paging_token,
              type: actType,
              amount:
                typeof transfer.amount === "string" ? transfer.amount : "0",
              from:
                typeof transfer.from === "string"
                  ? transfer.from
                  : typeof r.source_account === "string"
                    ? r.source_account
                    : "Unknown",
              to: typeof transfer.to === "string" ? transfer.to : "Unknown",
              timestamp: record.created_at,
              txHash: record.transaction_hash,
            });
            continue; // parsed successfully via balance changes
          }
        }

        // If we couldn't parse balance changes, mark as generic
        parsed.push({
          id: record.id,
          pagingToken: record.paging_token,
          type: "other",
          amount: "-",
          from:
            typeof r.source_account === "string" ? r.source_account : "Unknown",
          to: "-",
          timestamp: record.created_at,
          txHash: record.transaction_hash,
        });
      }
    }

    // Filter out "other" if we only want token activity, but keeping it helps visibility
    const filtered = parsed.filter((p) => p.type !== "other");

    return { records: filtered.length > 0 ? filtered : parsed, nextCursor };
  } catch (error) {
    console.error("Error fetching account operations from Horizon:", error);
    return { records: [], nextCursor: null };
  }
}

// ---------------------------------------------------------------------------
// Account balance helpers
// ---------------------------------------------------------------------------

export interface AccountBalance {
  assetType: "native" | "credit_alphanum4" | "credit_alphanum12";
  assetCode: string;
  assetIssuer: string;
  balance: string;
}

/**
 * Fetch all balances for a Stellar account from Horizon.
 */
export async function fetchAccountBalances(
  publicKey: string,
  config: NetworkConfig,
): Promise<AccountBalance[]> {
  const horizon = new StellarSdk.Horizon.Server(config.horizonUrl);
  const account = await horizon.loadAccount(publicKey);

  return account.balances.map((bal) => {
    if (bal.asset_type === "native") {
      return {
        assetType: "native" as const,
        assetCode: "XLM",
        assetIssuer: "",
        balance: bal.balance,
      };
    }
    const b = bal as unknown as {
      asset_type: string;
      asset_code: string;
      asset_issuer: string;
      balance: string;
    };
    return {
      assetType: b.asset_type as AccountBalance["assetType"],
      assetCode: b.asset_code,
      assetIssuer: b.asset_issuer,
      balance: b.balance,
    };
  });
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

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

export function parseTokenAmount(amount: string, decimals: number): bigint {
  const trimmed = amount.trim();
  if (!trimmed) {
    throw new Error("Amount is required");
  }

  if (trimmed.startsWith("-")) {
    throw new Error("Amount must be positive");
  }

  const [wholeRaw, fracRaw = ""] = trimmed.split(".");
  if (!/^\d+$/.test(wholeRaw || "0")) {
    throw new Error("Invalid amount");
  }
  if (fracRaw && !/^\d+$/.test(fracRaw)) {
    throw new Error("Invalid amount");
  }

  if (fracRaw.length > decimals) {
    throw new Error(`Too many decimal places (max ${decimals})`);
  }

  const whole = BigInt(wholeRaw || "0");
  const fracPadded = (fracRaw || "").padEnd(decimals, "0");
  const frac = fracPadded ? BigInt(fracPadded) : BigInt(0);
  const scale = BigInt(10) ** BigInt(decimals);
  return whole * scale + frac;
}

export async function fetchTokenDecimals(
  tokenContractId: string,
  config: NetworkConfig,
): Promise<number> {
  const result = await simulateCall(tokenContractId, "decimals", config);
  return decodeU32(result);
}

export function truncateAddress(addr: string, chars = 4): string {
  if (addr.length <= chars * 2 + 3) return addr;
  return `${addr.slice(0, chars + 1)}...${addr.slice(-chars)}`;
}

// ---------------------------------------------------------------------------
// Stellar Expert link helpers
// ---------------------------------------------------------------------------

/**
 * Generate a Stellar Expert URL for various blockchain entities.
 *
 * @param type - The type of entity: 'account', 'contract', or 'tx'
 * @param identifier - The public key, contract ID, or transaction hash
 * @param network - The network type ('testnet' or 'mainnet')
 * @returns The full Stellar Expert URL
 */
export function getStellarExpertUrl(
  type: "account" | "contract" | "tx",
  identifier: string,
  network: "testnet" | "mainnet" = "testnet",
): string {
  const baseUrl = "https://stellar.expert/explorer";
  return `${baseUrl}/${network}/${type}/${identifier}`;
}

// ---------------------------------------------------------------------------
// Supply breakdown helpers
// ---------------------------------------------------------------------------

export interface SupplyBreakdown {
  circulating: number;
  locked: number;
  burned: number;
  total: number;
}

/**
 * Calculate supply breakdown for a token.
 *
 * @param tokenContractId - The token contract ID
 * @param vestingContractId - Optional vesting contract ID to calculate locked supply
 * @returns Supply breakdown with circulating, locked, and burned amounts
 */
export async function fetchSupplyBreakdown(
  tokenContractId: string,
  config: NetworkConfig,
  vestingContractId?: string,
): Promise<SupplyBreakdown> {
  try {
    // Fetch total supply from token contract
    const totalSupplyVal = await simulateCall(
      tokenContractId,
      "total_supply",
      config,
    );
    const totalSupply = Number(decodeI128(totalSupplyVal));

    // For now, we'll estimate circulating supply as total supply
    // In a production app, you'd query all vesting contracts and subtract locked amounts
    let lockedSupply = 0;

    // If vesting contract provided, try to get locked amount
    // Note: This is a simplified approach. In production, you'd need to:
    // 1. Query all vesting schedules from the contract
    // 2. Sum up unvested amounts across all schedules
    if (vestingContractId) {
      try {
        // This is a placeholder - actual implementation would need to
        // enumerate all vesting schedules and sum unvested amounts
        // For now, we'll return 0 for locked
        lockedSupply = 0;
      } catch {
        // Vesting contract query failed, assume no locked supply
        lockedSupply = 0;
      }
    }

    // Burned supply: In Stellar/Soroban, burned tokens are typically sent to a null address
    // or the supply is reduced. For now, we'll calculate it as the difference
    // between max supply (if exists) and total supply
    let burnedSupply = 0;
    try {
      await simulateCall(
        tokenContractId,
        "max_supply",
        config,
      );
      // max_supply might return Option<i128>, need to handle that
      // For simplicity, we'll assume if it exists, burned = max - total
      // This is a simplified approach
    } catch {
      // No max_supply or it failed, assume no burned tokens
      burnedSupply = 0;
    }

    const circulatingSupply = totalSupply - lockedSupply - burnedSupply;

    return {
      circulating: circulatingSupply,
      locked: lockedSupply,
      burned: burnedSupply,
      total: totalSupply,
    };
  } catch (error) {
    console.error("[fetchSupplyBreakdown] Error:", error);
    throw new Error("Failed to fetch supply breakdown");
  }
}

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
  const horizon = new StellarSdk.Horizon.Server(getHorizonUrl());
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
  const assembled = await simulateAndAssembleTransaction(tx);
  return assembled.build().toXDR();
}

/**
 * Build a transaction XDR for SEP-41 approve (grant/revoke allowance).
 * Returns the unsigned transaction XDR string.
 */
export async function buildApproveTransaction(params: {
  tokenContractId: string;
  ownerAddress: string;
  spenderAddress: string;
  amount: bigint;
  expirationLedger: number;
}): Promise<string> {
  const {
    tokenContractId,
    ownerAddress,
    spenderAddress,
    amount,
    expirationLedger,
  } = params;

  const contract = new StellarSdk.Contract(tokenContractId);
  const ownerScVal = new StellarSdk.Address(ownerAddress).toScVal();
  const spenderScVal = new StellarSdk.Address(spenderAddress).toScVal();
  const amountScVal = StellarSdk.nativeToScVal(BigInt(amount), { type: "i128" });
  const expirationScVal = StellarSdk.nativeToScVal(BigInt(expirationLedger), { type: "u32" });

  const horizon = new StellarSdk.Horizon.Server(getHorizonUrl());
  const sourceAccount = await horizon.loadAccount(ownerAddress);

  const tx = new StellarSdk.TransactionBuilder(sourceAccount, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call("approve", ownerScVal, spenderScVal, amountScVal, expirationScVal))
    .setTimeout(30)
    .build();

  const assembled = await simulateAndAssembleTransaction(tx);
  return assembled.build().toXDR();
}

/**
 * Build a transaction XDR for SEP-41 transfer_from.
 * Returns the unsigned transaction XDR string.
 */
export async function buildTransferFromTransaction(params: {
  tokenContractId: string;
  spenderAddress: string;
  fromAddress: string;
  toAddress: string;
  amount: bigint;
}): Promise<string> {
  const { tokenContractId, spenderAddress, fromAddress, toAddress, amount } = params;

  const contract = new StellarSdk.Contract(tokenContractId);
  const spenderScVal = new StellarSdk.Address(spenderAddress).toScVal();
  const fromScVal = new StellarSdk.Address(fromAddress).toScVal();
  const toScVal = new StellarSdk.Address(toAddress).toScVal();
  const amountScVal = StellarSdk.nativeToScVal(BigInt(amount), { type: "i128" });

  const horizon = new StellarSdk.Horizon.Server(getHorizonUrl());
  const sourceAccount = await horizon.loadAccount(spenderAddress);

  const tx = new StellarSdk.TransactionBuilder(sourceAccount, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call("transfer_from", spenderScVal, fromScVal, toScVal, amountScVal))
    .setTimeout(30)
    .build();

  const assembled = await simulateAndAssembleTransaction(tx);
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

  const rpc = new StellarSdk.rpc.Server(getRpcUrl());
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
