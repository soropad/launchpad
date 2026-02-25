import { UseFormRegister, FieldErrors } from "react-hook-form";
import { Input } from "@/components/ui/Input";
import { DeployFormData } from "../DeployForm";

interface StepProps {
    register: UseFormRegister<DeployFormData>;
    errors: FieldErrors<DeployFormData>;
}

export const StepSupply = ({ register, errors }: StepProps) => {
    return (
        <div className="space-y-6 animate-fade-in-up">
            <div className="text-left">
                <h2 className="text-xl font-bold text-white mb-2">Supply Configuration</h2>
                <p className="text-sm text-gray-400">
                    Configure the total and initial supply of your token.
                </p>
            </div>

            <Input
                label="Initial Supply"
                type="number"
                placeholder="e.g. 1000000"
                {...register("initialSupply", { valueAsNumber: true })}
                error={errors.initialSupply?.message as string}
            />

            <Input
                label="Maximum Supply (Optional)"
                type="number"
                placeholder="Leave blank for uncapped"
                {...register("maxSupply", {
                    setValueAs: (v) => v === "" ? undefined : Number(v)
                })}
                error={errors.maxSupply?.message as string}
            />
        </div>
    );
};
