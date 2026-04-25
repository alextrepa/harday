import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { Bug, Download, FolderKanban, Inbox, ListTodo, Plug, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const settingsTabs = [
  { to: "/settings/general", label: "General", icon: Settings },
  { to: "/settings/connectors", label: "Connectors", icon: Plug },
  { to: "/settings/backlog", label: "Backlog", icon: ListTodo },
  { to: "/settings/projects", label: "Projects", icon: FolderKanban },
  { to: "/settings/export", label: "Time Logs", icon: Download },
  { to: "/settings/imports", label: "Sync Review", icon: Inbox },
  { to: "/settings/debug", label: "Debug", icon: Bug },
] as const;

export function SettingsLayout() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  return (
    <div className="settings-layout">
      <nav className="settings-sidebar" aria-label="Settings sections">
        {settingsTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = pathname.startsWith(tab.to);
          return (
            <Link
              key={tab.to}
              to={tab.to}
              className={cn(
                "settings-sidebar-item",
                isActive && "settings-sidebar-item-active",
              )}
            >
              <Icon className="settings-sidebar-icon" />
              <span className="settings-sidebar-label">{tab.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="settings-content">
        <Outlet />
      </div>
    </div>
  );
}
