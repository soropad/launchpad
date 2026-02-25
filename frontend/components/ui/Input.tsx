import React from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
    ({ label, error, className = "", ...props }, ref) => {
        return (
            <div className={`flex flex-col gap-1.5 w-full ${className}`}>
                {label && (
                    <label 
                        htmlFor={props.id || props.name}
                        className="text-sm font-medium text-gray-300 ml-1"
                    >
                        {label}
                    </label>
                )}
                <input
                    id={props.id || props.name}
                    ref={ref}
                    className={`
            bg-void-800/50 border border-stellar-500/10 rounded-xl px-4 py-3
            text-white placeholder:text-gray-500
            focus:outline-none focus:border-stellar-500/40 focus:ring-1 focus:ring-stellar-500/20
            transition-all duration-300
            ${error ? "border-red-500/50 focus:border-red-500/50 focus:ring-red-500/20" : ""}
          `}
                    {...props}
                />
                {error && <span className="text-xs text-red-400 ml-1">{error}</span>}
            </div>

        );
    }
);

Input.displayName = "Input";
