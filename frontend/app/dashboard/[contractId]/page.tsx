/**
 * /dashboard/[contractId] — Per-token dashboard.
 *
 * TODO (issue #9): Fetch and display:
 *   - token name/symbol/decimals, total/circulating supply, admin address
 *   - top holders table (via Horizon API)
 *   - vesting panel with progress bars (issue #11)
 *   - admin panel with mint/burn/transfer admin forms (issue #13)
 */

"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { useWallet } from "../../hooks/useWallet";
import { AdminPanel } from "./components/AdminPanel";
import { 
    Activity, 
    Layers, 
    Users, 
    ArrowLeftRight,
    Loader2
} from "lucide-react";

/* ── Dashboard Page ───────────────────────────────────────────── */

export default function TokenDashboard() {
    const params = useParams();
    const [contractId, setContractId] = useState<string>("");
    const { publicKey } = useWallet();
    
    const [loading, setLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);
    
    // TODO: Fetch real metadata from Soroban (Issue #9)
    const [tokenMetadata, setTokenMetadata] = useState<any>(null);

    useEffect(() => {
        // Resolve params which is a Promise in Next.js 15+
        const resolveParams = async () => {
            if (params) {
                const resolvedParams = await params;
                setContractId(resolvedParams.contractId as string);
            }
        };
        resolveParams();
    }, [params]);

    useEffect(() => {
        const fetchTokenData = async () => {
            if (!contractId) return;
            
            setLoading(true);
            try {
                // Mocking the fetch for now as Issue #9 is a prerequisite
                // In a real scenario, we'd use stellar-sdk to call the 'admin' or 'metadata' method
                const mockMetadata = {
                    name: "Soropad Token",
                    symbol: "SRP",
                    decimals: 7,
                    admin: "GBR3B7J6BGT7XPFQW7Z7R5W5B5B5B5B5B5B5B5B5B5B5B5B5B5B5", 
                };
                
                setTokenMetadata(mockMetadata);
                
                // Gating Logic: Check if connected wallet is the admin
                if (publicKey && publicKey === mockMetadata.admin) {
                    setIsAdmin(true);
                } else {
                    setIsAdmin(false);
                }
            } catch (err) {
                console.error("Failed to fetch token data:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchTokenData();
    }, [contractId, publicKey]);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh]">
                <Loader2 className="w-10 h-10 text-stellar-400 animate-spin mb-4" />
                <p className="text-stellar-200 animate-pulse">Loading dashboard...</p>
            </div>
        );
    }

    return (
        <main className="container mx-auto px-4 py-8 flex flex-col items-center">
            
            {/* Header / Stats Summary */}
            <div className="w-full max-w-4xl glass-card p-6 mb-8 flex flex-col md:flex-row justify-between items-center gap-6 text-center md:text-left">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-2">{tokenMetadata?.name} ({tokenMetadata?.symbol})</h1>
                    <p className="text-stellar-300 font-mono text-xs md:text-sm break-all">{contractId}</p>
                </div>
                <div className="flex gap-4">
                    <div className="text-center px-4 py-2 bg-white/5 rounded-lg border border-white/10 min-w-[100px]">
                        <span className="block text-[10px] text-stellar-400 uppercase font-bold tracking-wider">HODLers</span>
                        <span className="text-xl font-bold text-white">1,234</span>
                    </div>
                    <div className="text-center px-4 py-2 bg-white/5 rounded-lg border border-white/10 min-w-[100px]">
                        <span className="block text-[10px] text-stellar-400 uppercase font-bold tracking-wider">Transfers</span>
                        <span className="text-xl font-bold text-white">45.2k</span>
                    </div>
                </div>
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 w-full max-w-6xl">
                
                {/* Column 1: Activity & Holders */}
                <div className="space-y-8">
                    <section className="glass-card p-6">
                        <div className="flex items-center gap-2 mb-6">
                            <Activity className="w-5 h-5 text-stellar-300" />
                            <h2 className="text-xl font-bold text-white">Recent Activity</h2>
                        </div>
                        <div className="space-y-4">
                            {[1, 2, 3].map((i) => (
                                <div key={i} className="flex justify-between items-center py-3 border-b border-white/5 last:border-0">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-stellar-500/10 rounded-full">
                                            <ArrowLeftRight className="w-4 h-4 text-stellar-400" />
                                        </div>
                                        <div>
                                            <p className="text-sm text-white font-medium">Transfer</p>
                                            <p className="text-xs text-stellar-400">2 minutes ago</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm text-white font-bold">500 SRP</p>
                                        <p className="text-xs text-stellar-500">Confirmed</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                </div>

                {/* Column 2: Vesting & Distribution */}
                <div className="space-y-8">
                    <section className="glass-card p-6">
                        <div className="flex items-center gap-3 mb-6">
                            <Layers className="w-5 h-5 text-stellar-300" />
                            <h2 className="text-xl font-bold text-white">Vesting Schedule</h2>
                        </div>
                        <div className="bg-white/5 border border-dashed border-white/20 rounded-xl p-8 text-center">
                            <p className="text-stellar-300 text-sm">Vesting information will be available soon.</p>
                        </div>
                    </section>
                </div>

            </div>

            {/* Gated Admin Panel */}
            {isAdmin && <AdminPanel contractId={contractId} />}

            {/* User Interaction (Non-Admin) */}
            {!isAdmin && publicKey && (
                <div className="mt-12 w-full max-w-4xl text-center p-8 glass-card border-stellar-500/20 animate-in fade-in zoom-in duration-500">
                    <Users className="w-12 h-12 text-stellar-500 mx-auto mb-4 opacity-50" />
                    <h2 className="text-xl font-bold text-white mb-2">Token Holder Dashboard</h2>
                    <p className="text-stellar-300 max-w-md mx-auto">
                        You are currently viewing the token dashboard as a holder. 
                        Admin features are restricted to the contract owner.
                    </p>
                </div>
            )}

        </main>
    );
}
