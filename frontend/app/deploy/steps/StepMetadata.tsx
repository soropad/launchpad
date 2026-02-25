import { UseFormRegister, FieldErrors } from "react-hook-form";
import { Input } from "@/components/ui/Input";
import { DeployFormData } from "../DeployForm";

interface StepProps {
    register: UseFormRegister<DeployFormData>;
    errors: FieldErrors<DeployFormData>;
}

export const StepMetadata = ({ register, errors }: StepProps) => {
    return (
        <div className="space-y-6 animate-fade-in-up">
            <div className="text-left">
                <h2 className="text-xl font-bold text-white mb-2">Token Metadata</h2>
                <p className="text-sm text-gray-400">
                    Define the basic identity of your token.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                    label="Token Name"
                    placeholder="e.g. My Stellar Token"
                    {...register("name")}
                    error={errors.name?.message as string}
                />
                <Input
                    label="Symbol"
                    placeholder="e.g. MYTOK"
                    {...register("symbol")}
                    error={errors.symbol?.message as string}
                />
            </div>

            <Input
                label="Decimals"
                type="number"
                placeholder="Default is 7"
                {...register("decimals", { valueAsNumber: true })}
                error={errors.decimals?.message as string}
            />
        </div>
    );
};
