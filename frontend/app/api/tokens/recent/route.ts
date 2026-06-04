import { NextResponse } from "next/server";
import { NETWORKS, type NetworkType } from "@/types/network";
import { fetchRecentTokens, type RecentToken } from "@/lib/recentTokens";

interface CacheEntry {
  data: RecentToken[];
  expiresAt: number;
}

const CACHE_TTL_MS = 60_000;
const cache = new Map<string, CacheEntry>();

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const network = (searchParams.get("network") ?? "testnet") as NetworkType;

  if (network !== "testnet" && network !== "mainnet") {
    return NextResponse.json(
      { error: "Invalid network parameter." },
      { status: 400 },
    );
  }

  const cached = cache.get(network);
  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json(cached.data);
  }

  try {
    const config = NETWORKS[network];
    const tokens = await fetchRecentTokens(config);

    cache.set(network, {
      data: tokens,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });

    return NextResponse.json(tokens);
  } catch (error) {
    console.error("Failed to fetch recent tokens:", error);

    // If Mercury is not configured, return empty array with informational header
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (
      errorMessage.includes("getEvents") ||
      errorMessage.includes("Mercury") ||
      errorMessage.includes("MERCURY_AUTH_TOKEN")
    ) {
      const headers = new Headers();
      headers.set("X-Note", "Mercury indexer not configured");
      return NextResponse.json([], { headers });
    }

    return NextResponse.json(
      { error: "Failed to fetch recent tokens." },
      { status: 500 },
    );
  }
}
