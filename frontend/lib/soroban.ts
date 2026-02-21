import {
  Address,
  Asset,
  Keypair,
  Networks,
  Operation,
  TransactionBuilder,
  xdr,
  type Account,
  Contract,
  nativeToScVal,
  scValToNative,
} from "@stellar/stellar-sdk";

/**
 * Build a Soroban invocation transaction.
 */
export async function buildSorobanCall(params: {
  contractId: string;
  method: string;
  args: any[];
  publicKey: string;
  networkPassphrase: string;
  serverUrl: string;
}) {
  const { contractId, method, args, publicKey, networkPassphrase, serverUrl } =
    params;

  // In a real app, we'd fetch the account sequence from RPC.
  // For this implementation, we'll assume the frontend has access to the sequence
  // or we'll return the transaction for signing.

  const contract = new Contract(contractId);
  const call = contract.call(method, ...args);

  // We return the call object or the built transaction.
  // Since we don't have the account sequence here, we'll return the Operation
  // so the caller can build the full transaction.
  return call;
}

/**
 * Format address for ScVal
 */
export function addressToScVal(addr: string) {
  return new Address(addr).toScVal();
}

/**
 * Format i128 for ScVal
 */
export function i128ToScVal(amount: bigint | number) {
  return nativeToScVal(BigInt(amount), { type: "i128" });
}
