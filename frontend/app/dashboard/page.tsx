"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/Button";

export default function DashboardIndex() {
  const router = useRouter();
  const [contractId, setContractId] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const trimmed = contractId.trim();
    if (!trimmed) {
      setError("Please enter a contract ID.");
      return;
    }
    // Basic Soroban contract ID validation (56-char alphanumeric starting with C)
    if (!/^C[A-Z0-9]{55}$/.test(trimmed) && !/^G[A-Z2-7]{55}$/.test(trimmed)) {
      setError("Invalid contract ID format. Expected a 56-character Stellar address.");
      return;
    }

    setError("");
    router.push(`/dashboard/${trimmed}`);
  };

  return (
    <div className="mx-auto flex min-h-[80vh] max-w-3xl flex-col items-center justify-center px-6 text-center">
      <span className="text-5xl">📊</span>
      <h1 className="mt-4 text-3xl font-bold text-white">Token Dashboard</h1>
      <p className="mt-3 max-w-md text-gray-400">
        Enter a deployed token&apos;s contract ID to view supply metrics,
        holder distribution, and more.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 w-full max-w-lg">
        <div className="glass-card flex items-center gap-3 px-4 py-3">
          <Search className="h-5 w-5 shrink-0 text-gray-500" />
          <input
            type="text"
            value={contractId}
            onChange={(e) => {
              setContractId(e.target.value);
              if (error) setError("");
            }}
            placeholder="CABC123...XYZ (contract ID)"
            className="flex-1 bg-transparent text-sm text-white placeholder-gray-600 outline-none"
            aria-label="Contract ID"
            spellCheck={false}
            autoComplete="off"
          />
          <Button type="submit" className="shrink-0 px-4 py-2 text-sm">
            View
          </Button>
        </div>
        {error && (
          <p className="mt-2 text-left text-xs text-red-400">{error}</p>
        )}
      </form>
    </div>
  );
}
