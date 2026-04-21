import * as React from "react";
import { cn } from "@/lib/utils";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "min-h-20 w-full resize-y rounded border border-[var(--border)] bg-[var(--surface-lowest)] px-2.5 py-2 text-[13px] text-foreground placeholder:text-[var(--text-tertiary)] transition focus:border-[var(--border-focus)] focus:shadow-[0_0_0_2px_rgba(255,255,255,0.04)] disabled:opacity-50",
      className,
    )}
    {...props}
  />
));

Textarea.displayName = "Textarea";
