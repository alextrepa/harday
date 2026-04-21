import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Label({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("text-[12px] font-medium tracking-[0.01em] text-[var(--text-tertiary)]", className)}>
      {children}
    </label>
  );
}
