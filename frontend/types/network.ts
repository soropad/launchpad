import * as StellarSdk from "@stellar/stellar-sdk";

export type NetworkType = "testnet" | "mainnet";

export interface NetworkConfig {
  network: NetworkType;
  horizonUrl: string;
  rpcUrl: string;
  passphrase: string;
}

export const NETWORKS: Record<NetworkType, NetworkConfig> = {
  testnet: {
    network: "testnet",
    horizonUrl: "https://horizon-testnet.stellar.org",
    rpcUrl: "https://soroban-testnet.stellar.org",
    passphrase: StellarSdk.Networks.TESTNET,
  },
  mainnet: {
    network: "mainnet",
    horizonUrl: "https://horizon.stellar.org",
    rpcUrl: "https://mainnet.stellar.org:443",
    passphrase: StellarSdk.Networks.PUBLIC,
  },
};
