import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded border text-[13px] font-medium transition-all duration-150 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]",
  {
    variants: {
      variant: {
        default:   "border-transparent bg-foreground text-background hover:bg-accent",
        secondary: "border-[var(--border-hover)] bg-secondary text-foreground hover:bg-[var(--surface-highest)] hover:border-[var(--border-focus)]",
        ghost:     "border-transparent bg-transparent text-[var(--text-secondary)] hover:bg-secondary hover:text-foreground",
        outline:   "border-[var(--border)] bg-transparent text-[var(--text-secondary)] hover:bg-secondary hover:text-foreground hover:border-[var(--border-hover)]",
        danger:    "border-transparent bg-transparent text-[var(--danger)] hover:bg-[var(--danger-muted)]",
      },
      size: {
        sm:      "h-7 px-2 text-xs",
        default: "h-8 px-3",
        lg:      "h-9 px-4",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  ),
);

Button.displayName = "Button";
