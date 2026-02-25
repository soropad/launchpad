import { NextRequest, NextResponse } from "next/server";
import { fetchTokenInfo } from "@/lib/stellar";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ contractId: string }> }
) {
  try {
    const { contractId } = await params;
    const tokenInfo = await fetchTokenInfo(contractId);
    
    return NextResponse.json(tokenInfo);
  } catch (error) {
    console.error("Error fetching token metadata:", error);
    return NextResponse.json(
      { error: "Failed to fetch token metadata" },
      { status: 404 }
    );
  }
}