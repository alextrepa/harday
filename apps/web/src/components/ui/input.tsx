import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "h-9 w-full rounded border border-[var(--border)] bg-[var(--surface-lowest)] px-2.5 text-[13px] text-foreground placeholder:text-[var(--text-tertiary)] transition focus:border-[var(--border-focus)] focus:shadow-[0_0_0_2px_rgba(255,255,255,0.04)] disabled:opacity-50",
        className,
      )}
      {...props}
    />
  ),
);

Input.displayName = "Input";
