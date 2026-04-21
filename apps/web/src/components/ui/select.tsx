import type { SelectHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cn(
        "h-9 w-full rounded border border-[var(--border)] bg-[var(--surface-lowest)] px-2.5 text-[13px] text-foreground transition focus:border-[var(--border-focus)] focus:shadow-[0_0_0_2px_rgba(255,255,255,0.04)] disabled:opacity-50",
        props.className,
      )}
    />
  );
}
