import { type CSSProperties, useEffect, useState } from "react";
import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import {
  RiBugLine as Bug,
  RiDownloadLine as Download,
  RiFolderChartLine as FolderKanban,
  RiInboxLine as Inbox,
  RiListCheck3 as ListTodo,
  RiPlugLine as Plug,
  RiSettings3Line as Settings,
} from "@remixicon/react";
import {
  CustomSidebar,
  CustomSidebarLayout,
  CustomSidebarMenuButton,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
} from "@/components/custom-sidebar";
import { ScrollArea } from "@/components/ui/scroll-area";

const settingsTabs = [
  { to: "/settings/general", label: "General", icon: Settings },
  { to: "/settings/connectors", label: "Connectors", icon: Plug },
  { to: "/settings/backlog", label: "Backlog", icon: ListTodo },
  { to: "/settings/projects", label: "Projects", icon: FolderKanban },
  { to: "/settings/export", label: "Time Logs", icon: Download },
  { to: "/settings/imports", label: "Sync Review", icon: Inbox },
  { to: "/settings/debug", label: "Debug", icon: Bug },
] as const;
const SECTION_SIDEBAR_COLLAPSE_BREAKPOINT = 1520;

export function SettingsLayout() {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const [isSettingsSidebarOpen, setIsSettingsSidebarOpen] = useState(() =>
    typeof window === "undefined"
      ? true
      : window.innerWidth > SECTION_SIDEBAR_COLLAPSE_BREAKPOINT,
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia(
      `(max-width: ${SECTION_SIDEBAR_COLLAPSE_BREAKPOINT}px)`,
    );
    const handleViewportChange = () => {
      setIsSettingsSidebarOpen(!mediaQuery.matches);
    };

    handleViewportChange();
    mediaQuery.addEventListener("change", handleViewportChange);
    return () => mediaQuery.removeEventListener("change", handleViewportChange);
  }, []);

  return (
    <CustomSidebarLayout
      className="harday-settings-layout"
      style={
        {
          "--sidebar-width": "200px",
          "--sidebar-width-icon": "48px",
        } as CSSProperties
      }
      open={isSettingsSidebarOpen}
      onOpenChange={setIsSettingsSidebarOpen}
    >
      <CustomSidebar aria-label="Settings sections" collapsible="icon">
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {settingsTabs.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = pathname.startsWith(tab.to);
                  return (
                    <SidebarMenuItem key={tab.to}>
                      <CustomSidebarMenuButton
                        render={<Link to={tab.to} />}
                        isActive={isActive}
                      >
                        <Icon />
                        <span data-sidebar-collapsed="hide">{tab.label}</span>
                      </CustomSidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </CustomSidebar>

      <div className="settings-content-shell">
        <ScrollArea className="settings-content-scroll-area">
          <div className="settings-content">
            <Outlet />
          </div>
        </ScrollArea>
      </div>
    </CustomSidebarLayout>
  );
}
