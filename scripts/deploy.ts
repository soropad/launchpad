#!/usr/bin/env ts-node
// scripts/deploy.ts — CLI deployment script wrapping soroban-cli (issue #16)

import { execSync } from "child_process";
import { writeFileSync, existsSync, readFileSync } from "fs";
import { resolve } from "path";

const USAGE = `
Usage:
  npx ts-node scripts/deploy.ts \\
    --network testnet \\
    --admin <SECRET_KEY_OR_IDENTITY> \\
    --name "My Token" \\
    --symbol MTK \\
    --supply 1000000 \\
    --max-supply 10000000

Flags:
  --network      Soroban network (testnet | mainnet | futurenet)  [required]
  --admin        Stellar secret key or identity name               [required]
  --name         Token name                                        [required]
  --symbol       Token symbol                                      [required]
  --supply       Initial token supply                              [required]
  --max-supply   Maximum supply cap                                [optional]
  --decimals     Token decimal precision (default: 7)              [optional]
  --help         Show this help message
`.trim();

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------

function parseArgs(argv: string[]): Record<string, string> {
  const args: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--")) {
      const key = argv[i].slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith("--")) {
        args[key] = next;
        i++;
      } else {
        args[key] = "";
      }
    }
  }
  return args;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function validate(args: Record<string, string>): void {
  const required = ["network", "admin", "name", "symbol", "supply"];
  for (const flag of required) {
    if (!args[flag]) {
      console.error(`Error: --${flag} is required.\n`);
      console.error(USAGE);
      process.exit(1);
    }
  }

  if (!["testnet", "mainnet", "futurenet"].includes(args.network)) {
    console.error("Error: --network must be testnet, mainnet, or futurenet.");
    process.exit(1);
  }

  if (isNaN(Number(args.supply)) || Number(args.supply) < 1) {
    console.error("Error: --supply must be a positive number.");
    process.exit(1);
  }

  const maxSupply = args["max-supply"];
  if (maxSupply !== undefined && maxSupply !== "") {
    if (isNaN(Number(maxSupply)) || Number(maxSupply) < Number(args.supply)) {
      console.error("Error: --max-supply must be a number >= --supply.");
      process.exit(1);
    }
  }
}

// ---------------------------------------------------------------------------
// Shell helper
// ---------------------------------------------------------------------------

function exec(cmd: string, cwd: string): string {
  console.log(`> ${cmd}\n`);
  return execSync(cmd, {
    cwd,
    encoding: "utf-8",
    stdio: ["inherit", "pipe", "inherit"],
  }).trim();
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main(): void {
  const args = parseArgs(process.argv.slice(2));

  if ("help" in args) {
    console.log(USAGE);
    process.exit(0);
  }

  validate(args);

  const { network, admin, name, symbol, supply } = args;
  const maxSupply = args["max-supply"];
  const decimals = args.decimals || "7";
  const rootDir = resolve(__dirname, "..");
  const wasmPath = resolve(
    rootDir,
    "target/wasm32-unknown-unknown/release/soroban_token.wasm",
  );

  // Step 1 — Build the token contract
  console.log("\n=== Step 1/5: Building contract ===\n");
  exec("soroban contract build", rootDir);

  // Step 2 — Upload the WASM to the network
  console.log("\n=== Step 2/5: Uploading WASM ===\n");
  const wasmHash = exec(
    `soroban contract upload --wasm "${wasmPath}" --network ${network} --source ${admin}`,
    rootDir,
  );
  console.log(`WASM hash: ${wasmHash}`);

  // Step 3 — Deploy a new contract instance
  console.log("\n=== Step 3/5: Deploying contract ===\n");
  const contractId = exec(
    `soroban contract deploy --wasm-hash ${wasmHash} --network ${network} --source ${admin}`,
    rootDir,
  );
  console.log(`Contract ID: ${contractId}`);

  // Step 4 — Initialize the token
  console.log("\n=== Step 4/5: Initializing token ===\n");
  let initArgs = [
    `--admin ${admin}`,
    `--decimal ${decimals}`,
    `--name "${name}"`,
    `--symbol "${symbol}"`,
    `--initial_supply ${supply}`,
  ];
  if (maxSupply) {
    initArgs.push(`--max_supply ${maxSupply}`);
  }
  exec(
    `soroban contract invoke --id ${contractId} --network ${network} --source ${admin} -- initialize ${initArgs.join(" ")}`,
    rootDir,
  );
  console.log("Token initialized successfully.");

  // Step 5 — Write the contract ID to .env.local
  console.log("\n=== Step 5/5: Saving to .env.local ===\n");
  const envPath = resolve(rootDir, ".env.local");
  let envContent = "";

  if (existsSync(envPath)) {
    envContent = readFileSync(envPath, "utf-8");
    if (/^CONTRACT_ID=.*/m.test(envContent)) {
      envContent = envContent.replace(
        /^CONTRACT_ID=.*/m,
        `CONTRACT_ID=${contractId}`,
      );
    } else {
      envContent = envContent.trimEnd() + `\nCONTRACT_ID=${contractId}\n`;
    }
  } else {
    envContent = `CONTRACT_ID=${contractId}\n`;
  }

  writeFileSync(envPath, envContent);
  console.log(`Written CONTRACT_ID to .env.local`);

  // Summary
  console.log("\n=== Deployment complete ===");
  console.log(`Network:     ${network}`);
  console.log(`Contract ID: ${contractId}`);
  console.log(`Token:       ${name} (${symbol})`);
  console.log(`Decimals:    ${decimals}`);
  console.log(`Supply:      ${supply}`);
  if (maxSupply) {
    console.log(`Max supply:  ${maxSupply}`);
  }
}

main();
