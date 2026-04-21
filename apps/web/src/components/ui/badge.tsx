import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Badge({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-secondary px-2 py-0.5 text-[11px] font-medium tracking-[0.01em] text-[var(--text-secondary)]",
        className,
      )}
    >
      {children}
    </span>
  );
}
