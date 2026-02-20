import type { Metadata } from "next";
import TokenDashboard from "./TokenDashboard";

interface PageProps {
  params: Promise<{ contractId: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { contractId } = await params;
  return {
    title: `Token Dashboard — ${contractId.slice(0, 8)}... | SoroPad`,
    description: `View token details and holder distribution for contract ${contractId}`,
  };
}

export default async function TokenDashboardPage({ params }: PageProps) {
  const { contractId } = await params;

  return <TokenDashboard contractId={contractId} />;
}
