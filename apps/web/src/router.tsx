import {
  Navigate,
  Outlet,
  RouterProvider,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { z } from "zod";
import { AppShell } from "@/features/layout/app-shell";
import { BacklogPage } from "@/features/backlog/backlog-page";
import { ProjectsPage } from "@/features/projects/projects-page";
import { SettingsLayout } from "@/features/settings/settings-layout";
import { SettingsGeneralPage } from "@/features/settings/settings-general-page";
import { SettingsConnectorsPage } from "@/features/settings/settings-connectors-page";
import { SettingsBacklogPage } from "@/features/settings/settings-backlog-page";
import { SettingsImportReviewPage } from "@/features/settings/settings-import-review-page";
import { SettingsDebugPage } from "@/features/settings/settings-debug-page";
import { TimePage } from "@/features/time/time-page";
import { SignInPage } from "@/features/auth/sign-in-page";
import { useBootstrapSession } from "@/lib/session";
import { todayIsoDate } from "@/lib/utils";

const RouterDevtools = import.meta.env.DEV
  ? lazy(async () => {
      const module = await import("@tanstack/router-devtools");
      return { default: module.TanStackRouterDevtools };
    })
  : null;

const reviewSearchSchema = z.object({
  projectId: z.string().optional(),
  show: z.enum(["all", "uncategorized", "micro"]).optional(),
  group: z.enum(["none", "project"]).optional(),
});

function RootComponent() {
  useBootstrapSession();
  return (
    <>
      <Outlet />
      {RouterDevtools ? (
        <Suspense fallback={null}>
          <RouterDevtools />
        </Suspense>
      ) : null}
    </>
  );
}

function AuthGate() {
  return <AppShell />;
}

const rootRoute = createRootRoute({
  component: RootComponent,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: () => {
    return <Navigate to="/time/$date" params={{ date: "today" }} />;
  },
});

const signInRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/sign-in",
  component: SignInPage,
});

const appRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "app",
  component: AuthGate,
});

const timeRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/time/$date",
  component: () => {
    const params = timeRoute.useParams();
    return <TimePage date={params.date === "today" ? todayIsoDate() : params.date} />;
  },
});

const reviewRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/review/$date",
  validateSearch: reviewSearchSchema,
  component: () => {
    const params = reviewRoute.useParams();
    return (
      <Navigate
        to="/time/$date"
        params={{ date: params.date }}
        replace
      />
    );
  },
});

const activityRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/activity/$date",
  validateSearch: reviewSearchSchema,
  component: () => {
    const params = activityRoute.useParams();
    return <Navigate to="/time/$date" params={{ date: params.date === "today" ? "today" : params.date }} replace />;
  },
});

const projectsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/projects",
  component: () => <Navigate to="/settings/projects" replace />,
});

const projectDetailRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/projects/$projectId",
  component: () => {
    const params = projectDetailRoute.useParams();
    return (
      <Navigate
        to="/settings/projects/$projectId"
        params={{ projectId: params.projectId }}
        replace
      />
    );
  },
});

const backlogRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/backlog",
  component: BacklogPage,
});

const rulesRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/rules",
  component: () => <Navigate to="/settings" replace />,
});

const settingsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/settings",
  component: SettingsLayout,
});

const settingsIndexRoute = createRoute({
  getParentRoute: () => settingsRoute,
  path: "/",
  component: () => <Navigate to="/settings/general" replace />,
});

const settingsGeneralRoute = createRoute({
  getParentRoute: () => settingsRoute,
  path: "/general",
  component: SettingsGeneralPage,
});

const settingsConnectorsRoute = createRoute({
  getParentRoute: () => settingsRoute,
  path: "/connectors",
  component: SettingsConnectorsPage,
});

const settingsBacklogRoute = createRoute({
  getParentRoute: () => settingsRoute,
  path: "/backlog",
  component: SettingsBacklogPage,
});

const settingsImportReviewRoute = createRoute({
  getParentRoute: () => settingsRoute,
  path: "/imports",
  component: SettingsImportReviewPage,
});

const settingsDebugRoute = createRoute({
  getParentRoute: () => settingsRoute,
  path: "/debug",
  component: SettingsDebugPage,
});

const settingsProjectsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/settings/projects",
  component: ProjectsPage,
});

const settingsProjectDetailRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/settings/projects/$projectId",
  component: ProjectsPage,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  signInRoute,
  appRoute.addChildren([
    timeRoute,
    reviewRoute,
    activityRoute,
    backlogRoute,
    projectsRoute,
    projectDetailRoute,
    rulesRoute,
    settingsProjectsRoute,
    settingsProjectDetailRoute,
    settingsRoute.addChildren([
      settingsIndexRoute,
      settingsGeneralRoute,
      settingsConnectorsRoute,
      settingsBacklogRoute,
      settingsImportReviewRoute,
      settingsDebugRoute,
    ]),
  ]),
]);

const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

export function AppRouter() {
  return <RouterProvider router={router} />;
}
