import * as StellarSdk from "@stellar/stellar-sdk";
import { type NetworkConfig } from "../types/network";

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

/**
 * Simulate a read-only Soroban contract invocation and return the result xdr.
 */
async function simulateCall(
  contractId: string,
  method: string,
  config: NetworkConfig,
  args: StellarSdk.xdr.ScVal[] = []
): Promise<StellarSdk.xdr.ScVal> {
  const rpc = new StellarSdk.rpc.Server(config.rpcUrl);
  const contract = new StellarSdk.Contract(contractId);
  const account = new StellarSdk.Account(
    "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
    "0"
  );

  const tx = new StellarSdk.TransactionBuilder(account, {
    fee: "100",
    networkPassphrase: config.passphrase,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(30)
    .build();

  const sim = await rpc.simulateTransaction(tx);

  if (StellarSdk.rpc.Api.isSimulationError(sim)) {
    throw new Error(
      `Soroban simulation error (${method}): ${sim.error}`
    );
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
export async function fetchTokenInfo(
  contractId: string,
  config: NetworkConfig
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
  limit = 10
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
        const bal =
          acc.balances.find(
            (b) =>
              "asset_code" in b &&
              b.asset_code === _symbol &&
              "asset_issuer" in b &&
              b.asset_issuer === _issuer
          );
        const raw = BigInt(
          Math.round(parseFloat(bal ? bal.balance : "0") * 1e7)
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
export async function fetchCurrentLedger(config: NetworkConfig): Promise<number> {
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
  config: NetworkConfig
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

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

export function formatTokenAmount(
  raw: string,
  decimals: number
): string {
  if (raw === "N/A") return raw;
  const num = BigInt(raw);
  const divisor = BigInt(10) ** BigInt(decimals);
  const whole = num / divisor;
  const frac = num % divisor;

  if (frac === BigInt(0)) return whole.toLocaleString();

  const fracStr = frac.toString().padStart(decimals, "0").replace(/0+$/, "");
  return `${whole.toLocaleString()}.${fracStr}`;
}

export function truncateAddress(addr: string, chars = 4): string {
  if (addr.length <= chars * 2 + 3) return addr;
  return `${addr.slice(0, chars + 1)}...${addr.slice(-chars)}`;
}
