import { Page } from "@playwright/test";

/**
 * Inject a mock Freighter wallet into the page so that
 * `@stellar/freighter-api` calls resolve with a deterministic test keypair.
 *
 * The public key can be provided via the `TEST_PUBLIC_KEY` env variable or
 * defaults to a well-known testnet address.
 */
export const TEST_PUBLIC_KEY =
  process.env.TEST_PUBLIC_KEY ??
  "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";

export async function mockFreighter(page: Page, publicKey = TEST_PUBLIC_KEY) {
  await page.addInitScript(
    (pk: string) => {
      // Stub the module-level functions that WalletProvider imports from
      // @stellar/freighter-api.  The provider calls these as bare functions
      // so we patch the window.__FREIGHTER_API object that the API package
      // reads at runtime, AND override the ES-module globals.
      const api = {
        isConnected: async () => ({ isConnected: true }),
        isAllowed: async () => ({ isAllowed: true }),
        setAllowed: async () => ({ isAllowed: true }),
        getAddress: async () => ({ address: pk, error: "" }),
        signTransaction: async (xdr: string) => ({
          signedTxXdr: xdr,
          error: "",
        }),
        getNetwork: async () => ({
          network: "TESTNET",
          networkPassphrase: "Test SDF Network ; September 2015",
        }),
      };

      // Freighter detection: the real extension sets this.
      (window as any).__FREIGHTER_API = api;

      // Some bundled builds read directly from window.freighter
      (window as any).freighter = api;
    },
    publicKey,
  );
}
