import type { Metadata } from "next";
import { fetchTokenInfo } from "@/lib/stellar";
import PublicTokenPage from "./PublicTokenPage";

interface PageProps {
  params: Promise<{ contractId: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { contractId } = await params;

  try {
    const tokenInfo = await fetchTokenInfo(contractId);

    return {
      title: `${tokenInfo.name} (${tokenInfo.symbol}) — ${tokenInfo.totalSupply} Supply | SoroPad`,
      description: `View ${tokenInfo.name} token details, total supply of ${tokenInfo.totalSupply}, and holder distribution on Stellar Soroban.`,
      openGraph: {
        title: `${tokenInfo.name} (${tokenInfo.symbol})`,
        description: `Total Supply: ${tokenInfo.totalSupply} • View token details and holder distribution on Stellar Soroban`,
        type: "website",
        images: [
          {
            // Relative URL — resolved to absolute by metadataBase in root layout
            url: `/api/og/token/${contractId}`,
            width: 1200,
            height: 630,
            alt: `${tokenInfo.name} (${tokenInfo.symbol}) Token`,
          },
        ],
      },
      twitter: {
        card: "summary_large_image",
        title: `${tokenInfo.name} (${tokenInfo.symbol})`,
        description: `Total Supply: ${tokenInfo.totalSupply} • View token details on Stellar Soroban`,
        images: [`/api/og/token/${contractId}`],
      },
    };
  } catch (error) {
    console.error("Failed to fetch token metadata for OG:", error);
  }

  // Fallback metadata
  return {
    title: `Token Details — ${contractId.slice(0, 8)}... | SoroPad`,
    description: `View token details and holder distribution for contract ${contractId} on Stellar Soroban.`,
    openGraph: {
      title: `Token Details — ${contractId.slice(0, 8)}...`,
      description: `View token details and holder distribution on Stellar Soroban`,
      type: "website",
    },
  };
}

export default async function PublicTokenPageRoute({ params }: PageProps) {
  const { contractId } = await params;
  
  return <PublicTokenPage contractId={contractId} />;
}