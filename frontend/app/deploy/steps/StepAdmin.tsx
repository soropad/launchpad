import { UseFormRegister, FieldErrors } from "react-hook-form";
import { Input } from "@/components/ui/Input";
import { DeployFormData } from "../DeployForm";

interface StepProps {
    register: UseFormRegister<DeployFormData>;
    errors: FieldErrors<DeployFormData>;
}

export const StepAdmin = ({ register, errors }: StepProps) => {
    return (
        <div className="space-y-6 animate-fade-in-up">
            <div className="text-left">
                <h2 className="text-xl font-bold text-white mb-2">Admin Address</h2>
                <p className="text-sm text-gray-400">
                    Set the administrative controller for this token.
                </p>
            </div>

            <Input
                label="Admin Public Key"
                placeholder="G... (Stellar Address)"
                {...register("adminAddress")}
                error={errors.adminAddress?.message as string}
            />

            <p className="text-xs text-gray-500 italic">
                Warning: This address will have full control over minting, burning, and administrative functions.
            </p>
        </div>
    );
};
