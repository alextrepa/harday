import type { PropsWithChildren } from "react";
import { cn } from "@/lib/utils";

export function Card({ className, children }: PropsWithChildren<{ className?: string }>) {
  return (
    <div className={cn("rounded-lg border border-[var(--border)] bg-card", className)}>
      {children}
    </div>
  );
}

export function CardHeader({ className, children }: PropsWithChildren<{ className?: string }>) {
  return (
    <div className={cn("border-b border-[var(--border)] px-5 py-4", className)}>
      {children}
    </div>
  );
}

export function CardTitle({ className, children }: PropsWithChildren<{ className?: string }>) {
  return (
    <h2 className={cn("text-[15px] font-semibold tracking-[-0.02em] text-foreground", className)}>
      {children}
    </h2>
  );
}

export function CardContent({ className, children }: PropsWithChildren<{ className?: string }>) {
  return <div className={cn("px-5 py-4", className)}>{children}</div>;
}
