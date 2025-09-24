// components/ui/Button.tsx
import * as React from "react";
import { cn } from "../lib/utils";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "solana" | "outline";
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", type="button", ...props }, ref) => {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          "relative inline-flex items-center justify-center rounded-xl px-6 py-3 font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 ",
          variant === "default" &&
            "bg-gray-900 text-white hover:bg-gray-800 focus:ring-gray-500",
          variant === "solana" &&
            "text-white bg-gradient-to-r from-purple-600 via-fuchsia-600 to-green-400 " +
            "shadow-[0_0_15px_rgba(139,92,246,0.8),0_0_30px_rgba(52,211,153,0.6)] " +
            "hover:shadow-[0_0_25px_rgba(139,92,246,1),0_0_45px_rgba(52,211,153,0.8)] " +
            "hover:scale-105 active:scale-95 focus:ring-purple-500",
          variant === "outline" &&
            "text-white border-2 border-transparent bg-transparent " +
            "bg-gradient-to-r from-purple-600 via-fuchsia-600 to-green-400 " +
            "[background-clip:padding-box,border-box] " +
            "hover:scale-105 active:scale-95 " +
            "shadow-[0_0_15px_rgba(139,92,246,0.5),0_0_30px_rgba(52,211,153,0.4)]",
          className
        )}
        {...props}
      />
    );
  }
);

Button.displayName = "Button";
