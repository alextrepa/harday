import type {
  ComponentProps,
  ComponentType,
  ElementType,
  ReactNode,
} from "react";

import { cn } from "@/lib/utils";

type IconType = ComponentType<{ className?: string }>;

function AppPanel({
  as,
  className,
  ...props
}: ComponentProps<"div"> & { as?: ElementType }) {
  const Surface = as ?? "div";
  return <Surface className={cn("settings-panel", className)} {...props} />;
}

function MessagePanel({
  className,
  tone = "default",
  ...props
}: ComponentProps<"div"> & { tone?: "default" | "warning" }) {
  return (
    <div
      className={cn(
        "message-panel",
        tone === "warning" && "message-panel-warning",
        className,
      )}
      {...props}
    />
  );
}

function SurfaceCallout({
  icon: Icon,
  title,
  children,
  className,
}: {
  icon: IconType;
  title: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface-low)] p-4",
        className,
      )}
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--surface)] text-foreground">
        <Icon className="h-5 w-5" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="text-sm text-foreground/65">{children}</p>
      </div>
    </div>
  );
}

export { AppPanel, MessagePanel, SurfaceCallout };
