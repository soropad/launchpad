import { Control, useWatch } from "react-hook-form";
import { DeployFormData } from "../DeployForm";

interface StepProps {
    control: Control<DeployFormData>;
}

const SummaryItem = ({ label, value }: { label: string; value: string | number | undefined }) => (
    <div className="flex justify-between py-2 border-b border-white/5">
        <span className="text-gray-400 text-sm">{label}</span>
        <span className="text-white font-medium truncate ml-4 max-w-[200px]">
            {value || <span className="text-gray-600 italic">Not set</span>}
        </span>
    </div>
);

export const StepReview = ({ control }: StepProps) => {
    const formData = useWatch({ control });

    return (
        <div className="space-y-6 animate-fade-in-up">
            <div className="text-left">
                <h2 className="text-xl font-bold text-white mb-2">Review & Deploy</h2>
                <p className="text-sm text-gray-400">
                    Double check everything before launching on Soroban.
                </p>
            </div>

            <div className="glass-card p-4 space-y-1">
                <h3 className="text-xs font-bold text-stellar-400 uppercase tracking-widest mb-3">Token Details</h3>
                <SummaryItem label="Name" value={formData.name} />
                <SummaryItem label="Symbol" value={formData.symbol} />
                <SummaryItem label="Decimals" value={formData.decimals} />

                <h3 className="text-xs font-bold text-stellar-400 uppercase tracking-widest mt-6 mb-3">Supply</h3>
                <SummaryItem label="Initial Supply" value={formData.initialSupply} />
                <SummaryItem label="Max Supply" value={formData.maxSupply} />

                <h3 className="text-xs font-bold text-stellar-400 uppercase tracking-widest mt-6 mb-3">Governance</h3>
                <SummaryItem label="Admin" value={formData.adminAddress} />
            </div>

            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-xs text-amber-200/80">
                🚀 Once deployed, some settings like Symbol and Decimals cannot be changed.
            </div>
        </div>
    );
};
