import {
  Navigate,
  Outlet,
  RouterProvider,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { lazy, Suspense, type ReactNode } from "react";
import { z } from "zod";
import { AppShell } from "@/features/layout/app-shell";
import { useBootstrapSession } from "@/lib/session";
import { todayIsoDate } from "@/lib/utils";

const SignInPage = lazy(async () => {
  const module = await import("@/features/auth/sign-in-page");
  return { default: module.SignInPage };
});
const TimePage = lazy(async () => {
  const module = await import("@/features/time/time-page");
  return { default: module.TimePage };
});
const BacklogPage = lazy(async () => {
  const module = await import("@/features/backlog/backlog-page");
  return { default: module.BacklogPage };
});
const ProjectsPage = lazy(async () => {
  const module = await import("@/features/projects/projects-page");
  return { default: module.ProjectsPage };
});
const SettingsLayout = lazy(async () => {
  const module = await import("@/features/settings/settings-layout");
  return { default: module.SettingsLayout };
});
const SettingsGeneralPage = lazy(async () => {
  const module = await import("@/features/settings/settings-general-page");
  return { default: module.SettingsGeneralPage };
});
const SettingsConnectorsPage = lazy(async () => {
  const module = await import("@/features/settings/settings-connectors-page");
  return { default: module.SettingsConnectorsPage };
});
const SettingsBacklogPage = lazy(async () => {
  const module = await import("@/features/settings/settings-backlog-page");
  return { default: module.SettingsBacklogPage };
});
const SettingsProjectsPage = lazy(async () => {
  const module = await import("@/features/settings/settings-projects-page");
  return { default: module.SettingsProjectsPage };
});
const SettingsExportPage = lazy(async () => {
  const module = await import("@/features/settings/settings-export-page");
  return { default: module.SettingsExportPage };
});
const SettingsImportReviewPage = lazy(async () => {
  const module = await import("@/features/settings/settings-import-review-page");
  return { default: module.SettingsImportReviewPage };
});
const SettingsDebugPage = lazy(async () => {
  const module = await import("@/features/settings/settings-debug-page");
  return { default: module.SettingsDebugPage };
});

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

function RouteSuspense({ children }: { children: ReactNode }) {
  return <Suspense fallback={null}>{children}</Suspense>;
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
  component: () => (
    <RouteSuspense>
      <SignInPage />
    </RouteSuspense>
  ),
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
    return (
      <RouteSuspense>
        <TimePage date={params.date === "today" ? todayIsoDate() : params.date} />
      </RouteSuspense>
    );
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

const projectsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/projects",
  component: () => (
    <RouteSuspense>
      <ProjectsPage />
    </RouteSuspense>
  ),
});

const projectDetailRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/projects/$projectId",
  component: () => (
    <RouteSuspense>
      <ProjectsPage />
    </RouteSuspense>
  ),
});

const backlogRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/backlog",
  component: () => (
    <RouteSuspense>
      <BacklogPage />
    </RouteSuspense>
  ),
});

const rulesRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/rules",
  component: () => <Navigate to="/settings" replace />,
});

const settingsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/settings",
  component: () => (
    <RouteSuspense>
      <SettingsLayout />
    </RouteSuspense>
  ),
});

const settingsIndexRoute = createRoute({
  getParentRoute: () => settingsRoute,
  path: "/",
  component: () => <Navigate to="/settings/general" replace />,
});

const settingsGeneralRoute = createRoute({
  getParentRoute: () => settingsRoute,
  path: "/general",
  component: () => (
    <RouteSuspense>
      <SettingsGeneralPage />
    </RouteSuspense>
  ),
});

const settingsConnectorsRoute = createRoute({
  getParentRoute: () => settingsRoute,
  path: "/connectors",
  component: () => (
    <RouteSuspense>
      <SettingsConnectorsPage />
    </RouteSuspense>
  ),
});

const settingsBacklogRoute = createRoute({
  getParentRoute: () => settingsRoute,
  path: "/backlog",
  component: () => (
    <RouteSuspense>
      <SettingsBacklogPage />
    </RouteSuspense>
  ),
});

const settingsExportRoute = createRoute({
  getParentRoute: () => settingsRoute,
  path: "/export",
  component: () => (
    <RouteSuspense>
      <SettingsExportPage />
    </RouteSuspense>
  ),
});

const settingsImportReviewRoute = createRoute({
  getParentRoute: () => settingsRoute,
  path: "/imports",
  component: () => (
    <RouteSuspense>
      <SettingsImportReviewPage />
    </RouteSuspense>
  ),
});

const settingsDebugRoute = createRoute({
  getParentRoute: () => settingsRoute,
  path: "/debug",
  component: () => (
    <RouteSuspense>
      <SettingsDebugPage />
    </RouteSuspense>
  ),
});

const settingsProjectsRoute = createRoute({
  getParentRoute: () => settingsRoute,
  path: "/projects",
  component: () => (
    <RouteSuspense>
      <SettingsProjectsPage />
    </RouteSuspense>
  ),
});

const settingsProjectDetailRoute = createRoute({
  getParentRoute: () => settingsRoute,
  path: "/projects/$projectId",
  component: () => {
    const params = settingsProjectDetailRoute.useParams();
    return (
      <Navigate
        to="/projects/$projectId"
        params={{ projectId: params.projectId }}
        replace
      />
    );
  },
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  signInRoute,
  appRoute.addChildren([
    timeRoute,
    reviewRoute,
    backlogRoute,
    projectsRoute,
    projectDetailRoute,
    rulesRoute,
    settingsRoute.addChildren([
      settingsIndexRoute,
      settingsGeneralRoute,
      settingsConnectorsRoute,
      settingsBacklogRoute,
      settingsProjectsRoute,
      settingsProjectDetailRoute,
      settingsExportRoute,
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
