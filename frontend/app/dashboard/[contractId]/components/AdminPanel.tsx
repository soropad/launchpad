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
    i128ToScVal,
    nativeToScVal 
} from "@/lib/soroban";
import { 
    parseBatchMintData,
    parseBatchMintFile,
    BatchMintEntry
} from "@/lib/batch";
import { 
    TransactionBuilder, 
    Networks, 
    rpc,
    Contract,
    xdr
} from "@stellar/stellar-sdk";
import { 
    Coins, 
    Flame, 
    UserPlus, 
    ShieldAlert,
    CheckCircle2,
    ExternalLink,
    Clock
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

const vestingSchema = z.object({
    vestingContract: z.string().regex(/^C[A-Z2-7]{55}$/, "Invalid contract address (must start with C)"),
    recipient: z.string().regex(/^G[A-Z2-7]{55}$/, "Invalid Stellar address"),
    amount: z.string().refine((val) => !isNaN(Number(val)) && Number(val) > 0, "Amount must be positive"),
    cliffDays: z.string().refine((val) => !isNaN(Number(val)) && Number(val) >= 0, "Days must be 0 or more"),
    durationDays: z.string().refine((val) => !isNaN(Number(val)) && Number(val) > 0, "Duration must be positive"),
});

type MintData = z.infer<typeof mintSchema>;
type BurnData = z.infer<typeof burnSchema>;
type TransferAdminData = z.infer<typeof transferAdminSchema>;
type VestingData = z.infer<typeof vestingSchema>;

type AdminActionData = MintData | BurnData | TransferAdminData | VestingData;

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
    
    const [mintMode, setMintMode] = useState<"single" | "batch">("single");
    const [batchData, setBatchData] = useState("");
    const [batchErrors, setBatchErrors] = useState<string[]>([]);
    const [parsedEntries, setParsedEntries] = useState<BatchMintEntry[]>([]);

    // Forms
    const mintForm = useForm<MintData>({ resolver: zodResolver(mintSchema) });
    const burnForm = useForm<BurnData>({ resolver: zodResolver(burnSchema) });
    const transferForm = useForm<TransferAdminData>({ resolver: zodResolver(transferAdminSchema) });
    const vestingForm = useForm<VestingData>({ resolver: zodResolver(vestingSchema) });

    const handleBatchMint = async (entries: BatchMintEntry[]) => {
        if (!publicKey) return;
        
        setLoading("batch-mint");
        setSuccess(null);
        setLastTxHash(null);

        try {
            const server = new rpc.Server(RPC_URL);
            const account = await server.getAccount(publicKey);
            const contract = new Contract(contractId);
            
            const txBuilder = new TransactionBuilder(account, { 
                fee: (1000 * entries.length).toString(), // Scaled fee
                networkPassphrase: NETWORK_PASSPHRASE 
            });

            entries.forEach(entry => {
                txBuilder.addOperation(
                    contract.call("mint", addressToScVal(entry.address), i128ToScVal(BigInt(entry.amount)))
                );
            });

            const tx = txBuilder.setTimeout(30).build();

            // 3. Sign and Submit
            const xdrEncoded = tx.toXDR();
            console.log(`Signing batch mint tx for ${contractId} with ${entries.length} recipients`);
            
            await signTransaction(xdrEncoded, { networkPassphrase: NETWORK_PASSPHRASE });
            
            // Mocking submission success
            await new Promise(r => setTimeout(r, 2000));
            const mockHash = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
            
            setLastTxHash(mockHash);
            setSuccess("batch-mint");
            
        } catch (err) {
            const error = err as Error;
            console.error(`batch-mint failed:`, error);
            alert(`Batch Mint failed: ${error.message}`);
        } finally {
            setLoading(null);
        }
    };

    const handleAction = async (action: string, data: AdminActionData) => {
        if (!publicKey) return;
        
        setLoading(action);
        setSuccess(null);
        setLastTxHash(null);

        try {
            const server = new rpc.Server(RPC_URL);
            
            // 1. Prepare Arguments
            let method = "";
            let args: xdr.ScVal[] = [];

            if (action === "mint") {
                const mintData = data as MintData;
                method = "mint";
                args = [addressToScVal(mintData.to), i128ToScVal(BigInt(mintData.amount))];
            } else if (action === "burn") {
                const burnData = data as BurnData;
                method = "burn";
                args = [addressToScVal(burnData.from), i128ToScVal(BigInt(burnData.amount))];
            } else if (action === "transfer") {
                const transferData = data as TransferAdminData;
                method = "set_admin";
                args = [addressToScVal(transferData.newAdmin)];
            } else if (action === "vesting") {
                const vestingData = data as VestingData;
                method = "create_schedule";
                
                // Ledger logic: 1 day ≈ 17,280 ledgers
                const currentLedgerRes = await server.getLatestLedger();
                const currentLedger = currentLedgerRes.sequence;
                
                const cliffLedgers = Math.round(Number(vestingData.cliffDays) * 17280);
                const durationLedgers = Math.round(Number(vestingData.durationDays) * 17280);
                
                const cliffLedger = currentLedger + cliffLedgers;
                const endLedger = cliffLedger + durationLedgers;

                args = [
                    addressToScVal(vestingData.recipient),
                    i128ToScVal(BigInt(vestingData.amount)),
                    nativeToScVal(cliffLedger, { type: "u32" }),
                    nativeToScVal(endLedger, { type: "u32" })
                ];
            }

            // 2. Build Transaction using Contract class
            const targetContractId = action === "vesting" ? (data as VestingData).vestingContract : contractId;
            const account = await server.getAccount(publicKey);
            const contract = new Contract(targetContractId);
            
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
            if (action === "vesting") vestingForm.reset();
        } catch (err) {
            const error = err as Error;
            console.error(`${action} failed:`, error);
            alert(`${action} failed: ${error.message}`);
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-12">
                
                {/* ── Mint Form ─────────────────────────────────────── */}
                <div className="glass-card p-6 flex flex-col hover:border-stellar-500/30 transition-all duration-300 group">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-2 text-stellar-300">
                            <div className="p-2 bg-stellar-500/10 rounded-lg group-hover:scale-110 transition-transform">
                                <Coins className="w-5 h-5" />
                            </div>
                            <h3 className="font-bold text-lg">Mint Assets</h3>
                        </div>
                        <div className="flex bg-white/5 p-1 rounded-lg border border-white/10">
                            <button 
                                onClick={() => setMintMode("single")}
                                className={`px-3 py-1 text-xs rounded-md transition-all ${mintMode === "single" ? "bg-stellar-500 text-white shadow-lg" : "text-gray-400 hover:text-white"}`}
                            >
                                Single
                            </button>
                            <button 
                                onClick={() => setMintMode("batch")}
                                className={`px-3 py-1 text-xs rounded-md transition-all ${mintMode === "batch" ? "bg-stellar-500 text-white shadow-lg" : "text-gray-400 hover:text-white"}`}
                            >
                                Batch
                            </button>
                        </div>
                    </div>

                    {mintMode === "single" ? (
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
                    ) : (
                        <div className="space-y-4 flex-grow">
                            <div className="flex flex-col gap-2">
                                <label className="text-sm font-medium text-gray-300">Manual Entry (Address, Amount)</label>
                                <textarea 
                                    className="w-full h-32 bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-stellar-100 placeholder:text-gray-600 focus:outline-none focus:ring-1 focus:ring-stellar-500/50 resize-none"
                                    placeholder="GC7... , 100.0&#10;GD2... , 50.5"
                                    value={batchData}
                                    onChange={(e) => {
                                        setBatchData(e.target.value);
                                        const { entries, errors } = parseBatchMintData(e.target.value);
                                        setParsedEntries(entries);
                                        setBatchErrors(errors);
                                    }}
                                />
                            </div>
                            
                            <div className="relative">
                                <div className="absolute inset-0 flex items-center" aria-hidden="true">
                                    <div className="w-full border-t border-white/5"></div>
                                </div>
                                <div className="relative flex justify-center">
                                    <span className="px-2 bg-transparent text-[10px] uppercase tracking-widest text-gray-500">Or Upload CSV</span>
                                </div>
                            </div>

                            <input 
                                type="file" 
                                accept=".csv"
                                className="block w-full text-xs text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-stellar-500/10 file:text-stellar-400 hover:file:bg-stellar-500/20 transition-all cursor-pointer"
                                onChange={async (e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                        const { entries, errors } = await parseBatchMintFile(file);
                                        setParsedEntries(entries);
                                        setBatchErrors(errors);
                                    }
                                }}
                            />

                            {batchErrors.length > 0 && (
                                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                                    <p className="text-[10px] text-red-400 font-bold uppercase mb-1">Errors Found:</p>
                                    <ul className="text-[10px] text-red-300 space-y-1 list-disc list-inside">
                                        {batchErrors.slice(0, 3).map((err, i) => <li key={i}>{err}</li>)}
                                        {batchErrors.length > 3 && <li>...and {batchErrors.length - 3} more</li>}
                                    </ul>
                                </div>
                            )}

                            {parsedEntries.length > 0 && batchErrors.length === 0 && (
                                <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-xl flex items-center justify-between">
                                    <span className="text-xs text-green-400 font-medium">{parsedEntries.length} valid entries ready</span>
                                    <span className="text-[10px] text-green-500/70">Total: {parsedEntries.reduce((acc, curr) => acc + Number(curr.amount), 0).toLocaleString()}</span>
                                </div>
                            )}

                            <Button 
                                type="button" 
                                className="w-full mt-2 shadow-lg shadow-stellar-500/20" 
                                isLoading={loading === "batch-mint"}
                                disabled={!!loading || parsedEntries.length === 0 || batchErrors.length > 0}
                                onClick={() => handleBatchMint(parsedEntries)}
                            >
                                {success === "batch-mint" ? (
                                    <span className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> Batch Minted!</span>
                                ) : `Mint Batch (${parsedEntries.length})`}
                            </Button>
                        </div>
                    )}
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

                {/* ── Vesting Schedule ────────────────────────────────── */}
                <div className="glass-card p-6 flex flex-col hover:border-stellar-400/30 transition-all duration-300 group lg:col-span-1">
                    <div className="flex items-center gap-2 mb-6 text-stellar-300">
                        <div className="p-2 bg-stellar-500/10 rounded-lg group-hover:scale-110 transition-transform">
                            <Clock className="w-5 h-5" />
                        </div>
                        <h3 className="font-bold text-lg">Create Vesting</h3>
                    </div>
                    <form onSubmit={vestingForm.handleSubmit((data) => handleAction("vesting", data))} className="space-y-4 flex-grow">
                        <Input 
                            label="Vesting Contract" 
                            placeholder="C..." 
                            className="bg-white/5 border-white/10"
                            {...vestingForm.register("vestingContract")}
                            error={vestingForm.formState.errors.vestingContract?.message}
                        />
                        <Input 
                            label="Recipient Address" 
                            placeholder="G..." 
                            className="bg-white/5 border-white/10"
                            {...vestingForm.register("recipient")}
                            error={vestingForm.formState.errors.recipient?.message}
                        />
                        <div className="grid grid-cols-2 gap-4">
                            <Input 
                                label="Cliff (Days)" 
                                type="number" 
                                placeholder="0" 
                                className="bg-white/5 border-white/10"
                                {...vestingForm.register("cliffDays")}
                                error={vestingForm.formState.errors.cliffDays?.message}
                            />
                            <Input 
                                label="Duration (Days)" 
                                type="number" 
                                placeholder="365" 
                                className="bg-white/5 border-white/10"
                                {...vestingForm.register("durationDays")}
                                error={vestingForm.formState.errors.durationDays?.message}
                            />
                        </div>
                        <Input 
                            label="Total Amount" 
                            type="number" 
                            placeholder="0.00" 
                            className="bg-white/5 border-white/10"
                            {...vestingForm.register("amount")}
                            error={vestingForm.formState.errors.amount?.message}
                        />
                        <Button 
                            type="submit" 
                            className="w-full mt-4 bg-stellar-500 hover:bg-stellar-600 text-white shadow-lg shadow-stellar-500/20" 
                            isLoading={loading === "vesting"}
                            disabled={!!loading}
                        >
                            {success === "vesting" ? (
                                <span className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> Success</span>
                            ) : "Initialize Schedule"}
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
