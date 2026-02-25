"use client";

import React, { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface AlertProps {
  className?: string;
  children: ReactNode;
  variant?: "default" | "destructive" | "warning" | "success";
}

interface AlertTitleProps {
  className?: string;
  children: ReactNode;
}

interface AlertDescriptionProps {
  className?: string;
  children: ReactNode;
}

const variants = {
  default: "bg-blue-600/10 border border-blue-600/50 text-blue-300",
  destructive: "bg-red-600/10 border border-red-600/50 text-red-300",
  warning: "bg-yellow-600/10 border border-yellow-600/50 text-yellow-300",
  success: "bg-green-600/10 border border-green-600/50 text-green-300",
};

/**
 * Alert - Display important messages
 */
export function Alert({ className, children, variant = "default" }: AlertProps) {
  return (
    <div className={cn("rounded-lg p-4", variants[variant], className)}>
      {children}
    </div>
  );
}

/**
 * AlertTitle - Title of an alert
 */
export function AlertTitle({ className, children }: AlertTitleProps) {
  return <h5 className={cn("mb-1 font-medium leading-tight", className)}>{children}</h5>;
}

/**
 * AlertDescription - Description text of an alert
 */
export function AlertDescription({ className, children }: AlertDescriptionProps) {
  return <div className={cn("text-sm opacity-90", className)}>{children}</div>;
}
