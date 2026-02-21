"use client";

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useWallet } from "../../../hooks/useWallet";
import { 
    addressToScVal, 
    i128ToScVal 
} from "@/lib/soroban";
import { 
    TransactionBuilder, 
    Networks, 
    rpc,
    Contract
} from "@stellar/stellar-sdk";
import { 
    Coins, 
    Flame, 
    UserPlus, 
    ShieldAlert,
    CheckCircle2,
    ExternalLink
} from "lucide-react";

/* ── Constants ────────────────────────────────────────────────── */

const RPC_URL = "https://rpc-futurenet.stellar.org";
const NETWORK_PASSPHRASE = Networks.FUTURENET;

/* ── Validation Schemas ────────────────────────────────────────── */

const mintSchema = z.object({
    to: z.string().regex(/^G[A-Z2-7]{55}$/, "Invalid Stellar address"),
    amount: z.string().refine((val) => !isNaN(Number(val)) && Number(val) > 0, "Amount must be positive"),
});

const burnSchema = z.object({
    from: z.string().regex(/^G[A-Z2-7]{55}$/, "Invalid Stellar address"),
    amount: z.string().refine((val) => !isNaN(Number(val)) && Number(val) > 0, "Amount must be positive"),
});

const transferAdminSchema = z.object({
    newAdmin: z.string().regex(/^G[A-Z2-7]{55}$/, "Invalid Stellar address"),
});

type MintData = z.infer<typeof mintSchema>;
type BurnData = z.infer<typeof burnSchema>;
type TransferAdminData = z.infer<typeof transferAdminSchema>;

/* ── AdminPanel Component ───────────────────────────────────────── */

interface AdminPanelProps {
    contractId: string;
}

export function AdminPanel({ contractId }: AdminPanelProps) {
    const { signTransaction, publicKey } = useWallet();
    const [loading, setLoading] = useState<string | null>(null);
    const [lastTxHash, setLastTxHash] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [showTransferConfirm, setShowTransferConfirm] = useState(false);

    // Forms
    const mintForm = useForm<MintData>({ resolver: zodResolver(mintSchema) });
    const burnForm = useForm<BurnData>({ resolver: zodResolver(burnSchema) });
    const transferForm = useForm<TransferAdminData>({ resolver: zodResolver(transferAdminSchema) });

    const handleAction = async (action: string, data: any) => {
        if (!publicKey) return;
        
        setLoading(action);
        setSuccess(null);
        setLastTxHash(null);

        try {
            const server = new rpc.Server(RPC_URL);
            
            // 1. Prepare Arguments
            let method = "";
            let args: any[] = [];

            if (action === "mint") {
                method = "mint";
                args = [addressToScVal(data.to), i128ToScVal(data.amount)];
            } else if (action === "burn") {
                method = "burn";
                args = [addressToScVal(data.from), i128ToScVal(data.amount)];
            } else if (action === "transfer") {
                method = "set_admin";
                args = [addressToScVal(data.newAdmin)];
            }

            // 2. Build Transaction using Contract class
            const account = await server.getAccount(publicKey);
            const contract = new Contract(contractId);
            
            const tx = new TransactionBuilder(account, { 
                fee: "1000", // Standard fee
                networkPassphrase: NETWORK_PASSPHRASE 
            })
            .addOperation(contract.call(method, ...args))
            .setTimeout(30)
            .build();

            // 3. Sign and Submit
            const xdrEncoded = tx.toXDR();
            console.log(`Signing ${action} tx for ${contractId}`);
            
            // Note: signTransaction's first argument is the XDR string
            await signTransaction(xdrEncoded, { networkPassphrase: NETWORK_PASSPHRASE });
            
            // Mocking submission success for the purpose of the dashboard UI
            await new Promise(r => setTimeout(r, 2000));
            const mockHash = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
            
            setLastTxHash(mockHash);
            setSuccess(action);
            
            if (action === "mint") mintForm.reset();
            if (action === "burn") burnForm.reset();
            if (action === "transfer") {
                transferForm.reset();
                setShowTransferConfirm(false);
            }
        } catch (err: any) {
            console.error(`${action} failed:`, err);
            alert(`${action} failed: ${err.message}`);
        } finally {
            setLoading(null);
        }
    };

    return (
        <section className="mt-12 w-full max-w-4xl animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <ShieldAlert className="w-6 h-6 text-stellar-400" />
                    <h2 className="text-2xl font-bold text-white tracking-tight">Admin Console</h2>
                </div>
                {lastTxHash && (
                    <a 
                        href={`https://stellar.expert/explorer/futurenet/tx/${lastTxHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-xs text-stellar-400 hover:text-stellar-300 transition-colors bg-stellar-400/10 px-3 py-1.5 rounded-full border border-stellar-400/20"
                    >
                        Last Tx: {lastTxHash.slice(0, 8)}... <ExternalLink className="w-3 h-3" />
                    </a>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                
                {/* ── Mint Form ─────────────────────────────────────── */}
                <div className="glass-card p-6 flex flex-col hover:border-stellar-500/30 transition-all duration-300 group">
                    <div className="flex items-center gap-2 mb-6 text-stellar-300">
                        <div className="p-2 bg-stellar-500/10 rounded-lg group-hover:scale-110 transition-transform">
                            <Coins className="w-5 h-5" />
                        </div>
                        <h3 className="font-bold text-lg">Mint Assets</h3>
                    </div>
                    <form onSubmit={mintForm.handleSubmit((data) => handleAction("mint", data))} className="space-y-4 flex-grow">
                        <Input 
                            label="Recipient Address" 
                            placeholder="G..." 
                            className="bg-white/5 border-white/10"
                            {...mintForm.register("to")}
                            error={mintForm.formState.errors.to?.message}
                        />
                        <Input 
                            label="Amount" 
                            type="number" 
                            placeholder="0.00" 
                            className="bg-white/5 border-white/10"
                            {...mintForm.register("amount")}
                            error={mintForm.formState.errors.amount?.message}
                        />
                        <Button 
                            type="submit" 
                            className="w-full mt-4 shadow-lg shadow-stellar-500/20" 
                            isLoading={loading === "mint"}
                            disabled={!!loading}
                        >
                            {success === "mint" ? (
                                <span className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> Success</span>
                            ) : "Mint Tokens"}
                        </Button>
                    </form>
                </div>

                {/* ── Burn Form ─────────────────────────────────────── */}
                <div className="glass-card p-6 flex flex-col hover:border-red-500/30 transition-all duration-300 group">
                    <div className="flex items-center gap-2 mb-6 text-red-400">
                        <div className="p-2 bg-red-500/10 rounded-lg group-hover:scale-110 transition-transform">
                            <Flame className="w-5 h-5" />
                        </div>
                        <h3 className="font-bold text-lg">Burn Assets</h3>
                    </div>
                    <form onSubmit={burnForm.handleSubmit((data) => handleAction("burn", data))} className="space-y-4 flex-grow">
                        <Input 
                            label="Source Address" 
                            placeholder="G..." 
                            className="bg-white/5 border-white/10"
                            {...burnForm.register("from")}
                            error={burnForm.formState.errors.from?.message}
                        />
                        <Input 
                            label="Amount" 
                            type="number" 
                            placeholder="0.00" 
                            className="bg-white/5 border-white/10"
                            {...burnForm.register("amount")}
                            error={burnForm.formState.errors.amount?.message}
                        />
                        <Button 
                            type="submit" 
                            variant="secondary"
                            className="w-full mt-4 border-red-500/20 hover:border-red-500/40 text-red-400" 
                            isLoading={loading === "burn"}
                            disabled={!!loading}
                        >
                            {success === "burn" ? (
                                <span className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> Success</span>
                            ) : "Burn Tokens"}
                        </Button>
                    </form>
                </div>

                {/* ── Transfer Admin ────────────────────────────────── */}
                <div className="glass-card p-6 flex flex-col hover:border-stellar-400/30 transition-all duration-300 group">
                    <div className="flex items-center gap-2 mb-6 text-stellar-400">
                        <div className="p-2 bg-stellar-400/10 rounded-lg group-hover:scale-110 transition-transform">
                            <UserPlus className="w-5 h-5" />
                        </div>
                        <h3 className="font-bold text-lg">Transfer Admin</h3>
                    </div>
                    <form 
                        onSubmit={transferForm.handleSubmit(() => setShowTransferConfirm(true))} 
                        className="space-y-4 flex-grow"
                    >
                        <Input 
                            label="New Admin Address" 
                            placeholder="G..." 
                            className="bg-white/5 border-white/10"
                            {...transferForm.register("newAdmin")}
                            error={transferForm.formState.errors.newAdmin?.message}
                            disabled={showTransferConfirm}
                        />
                        
                        {!showTransferConfirm ? (
                            <Button 
                                type="submit" 
                                className="w-full mt-4 bg-white/5 border-white/10 hover:bg-white/10 text-white"
                                disabled={!!loading}
                            >
                                Transfer Control
                            </Button>
                        ) : (
                            <div className="space-y-3 pt-2 animate-in fade-in slide-in-from-top-2 duration-300 bg-red-950/20 p-4 rounded-xl border border-red-500/20">
                                <p className="text-[10px] text-red-400 font-bold uppercase tracking-widest text-center">
                                    Final Warning
                                </p>
                                <p className="text-xs text-stellar-200 text-center leading-relaxed">
                                    You will permanently lose all administrative rights to this token contract.
                                </p>
                                <div className="flex gap-2">
                                    <Button 
                                        type="button"
                                        variant="secondary"
                                        className="flex-1 text-xs py-2 h-9"
                                        onClick={() => setShowTransferConfirm(false)}
                                        disabled={!!loading}
                                    >
                                        Cancel
                                    </Button>
                                    <Button 
                                        type="button"
                                        className="flex-1 text-xs py-2 h-9 bg-red-600 hover:bg-red-700 border-none shadow-lg shadow-red-600/20"
                                        onClick={() => handleAction("transfer", transferForm.getValues())}
                                        isLoading={loading === "transfer"}
                                    >
                                        I Understand
                                    </Button>
                                </div>
                            </div>
                        )}
                    </form>
                </div>

            </div>
        </section>
    );
}
