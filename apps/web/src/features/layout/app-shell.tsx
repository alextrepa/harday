import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { ListTodo, Play, Settings, Square, Timer, X } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { getConnectorsOverview, syncAzureDevOpsConnection } from "@/lib/app-api";
import { localStore } from "@/lib/local-store";
import { isDesktopShell } from "@/lib/runtime";
import { cn, getIsoWeekDates, todayIsoDate } from "@/lib/utils";
import { useLocalProjects, useLocalState } from "@/lib/local-hooks";
import { useApplyTheme } from "@/lib/use-theme";

const navItems = [
  { to: "/time/$date", params: { date: "today" }, label: "Time", icon: Timer },
  { to: "/backlog", label: "Backlog", icon: ListTodo },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

const AUTO_SYNC_POLL_INTERVAL_MS = 30_000;

function isNavItemActive(pathname: string, to: (typeof navItems)[number]["to"]) {
  if (to === "/time/$date") {
    return pathname.startsWith("/time/") || pathname.startsWith("/review/");
  }

  if (to === "/settings") {
    return pathname.startsWith("/settings");
  }

  return pathname === to;
}

function isCompactTimerActive(pathname: string) {
  return pathname.startsWith("/time/") || pathname.startsWith("/review/");
}

function formatDurationShort(durationMs: number) {
  const totalMinutes = Math.max(0, Math.round(durationMs / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}:${String(minutes).padStart(2, "0")}`;
}

function AzureDevOpsAutoSyncScheduler() {
  const loopStateRef = useRef({
    cancelled: false,
    running: false,
    timeoutId: undefined as number | undefined,
  });

  useEffect(() => {
    const loopState = loopStateRef.current;
    loopState.cancelled = false;

    const scheduleNext = (delayMs = AUTO_SYNC_POLL_INTERVAL_MS) => {
      if (loopState.cancelled) {
        return;
      }

      loopState.timeoutId = window.setTimeout(() => {
        void tick();
      }, delayMs);
    };

    const tick = async () => {
      if (loopState.cancelled || loopState.running) {
        scheduleNext();
        return;
      }

      loopState.running = true;
      try {
        const overview = await getConnectorsOverview();
        const now = Date.now();
        const dueConnections = overview.azureDevOpsConnections.filter((connection) => {
          if (!connection.autoSync) {
            return false;
          }

          if (!connection.lastSyncAt) {
            return true;
          }

          return now - connection.lastSyncAt >= connection.autoSyncIntervalMinutes * 60_000;
        });

        for (const connection of dueConnections) {
          if (loopState.cancelled) {
            break;
          }

          await syncAzureDevOpsConnection(connection.id, { trigger: "auto" });
        }
      } catch (error) {
        console.error("Azure DevOps auto sync failed.", error);
      } finally {
        loopState.running = false;
        scheduleNext();
      }
    };

    void tick();

    return () => {
      loopState.cancelled = true;
      if (loopState.timeoutId !== undefined) {
        window.clearTimeout(loopState.timeoutId);
      }
    };
  }, []);

  return null;
}

/* ── Quick Timer Popup ─────────────────────────────────────────────── */

function QuickTimerPopup({
  anchorRef,
  runningDurationMs,
  onClose,
}: {
  anchorRef: RefObject<HTMLDivElement | null>;
  runningDurationMs: number;
  onClose: () => void;
}) {
  const state = useLocalState();
  const projects = useLocalProjects();
  const popupRef = useRef<HTMLDivElement>(null);

  const currentTimer = state.timers[0] ?? null;

  const projectId = currentTimer?.projectId ?? "";
  const taskId = currentTimer?.taskId ?? "";
  const note = currentTimer?.note ?? "";

  const projectOptions = useMemo(
    () =>
      projects.map((project) => ({
        value: project._id,
        label: project.code ? `[${project.code}] ${project.name}` : project.name,
        keywords: [project.name, project.code ?? ""],
      })),
    [projects],
  );
  const availableTasks = useMemo(
    () =>
      projects
        .find((p) => p._id === projectId)
        ?.tasks.filter((t) => t.status === "active") ?? [],
    [projectId, projects],
  );
  const taskOptions = useMemo(
    () =>
      availableTasks.map((task) => ({
        value: task._id,
        label: task.name,
      })),
    [availableTasks],
  );

  // Close on click outside
  useEffect(() => {
    function handleMouseDown(event: MouseEvent) {
      const target = event.target as Node;
      if (anchorRef.current?.contains(target) || popupRef.current?.contains(target)) {
        return;
      }

      if (popupRef.current) {
        onClose();
      }
    }

    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [anchorRef, onClose]);

  // Close on Escape
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (!currentTimer) {
    return null;
  }

  function handleProjectChange(nextProjectId: string) {
    if (!currentTimer) return;
    localStore.updateTimer(currentTimer._id, {
      projectId: nextProjectId || undefined,
      taskId: undefined,
    });
  }

  function handleTaskChange(nextTaskId: string) {
    if (!currentTimer) return;
    localStore.updateTimer(currentTimer._id, { taskId: nextTaskId || undefined });
  }

  function handleNoteChange(nextNote: string) {
    if (!currentTimer) return;
    localStore.updateTimer(currentTimer._id, { note: nextNote || undefined });
  }

  function handleSave() {
    if (!currentTimer) return;
    localStore.saveTimer(currentTimer._id);
    onClose();
  }

  function handleCancel() {
    if (!currentTimer) return;
    localStore.cancelTimer(currentTimer._id);
    onClose();
  }

  return (
    <div ref={popupRef} className="quick-timer-popup">
      {/* Header */}
      <div className="quick-timer-popup-header">
        <span className="quick-timer-popup-title">Running timer</span>
        <span className="quick-timer-popup-duration">
          {formatDurationShort(runningDurationMs)}
        </span>
      </div>

      {/* Project */}
      <label className="field">
        <span className="field-label">Project</span>
        <SearchableSelect
          value={projectId}
          options={projectOptions}
          onChange={handleProjectChange}
          placeholder="No project"
          clearLabel="No project"
          emptyMessage="No matching projects"
          ariaLabel="Project"
        />
      </label>

      {/* Task */}
      <label className="field">
        <span className="field-label">Task</span>
        <SearchableSelect
          value={taskId}
          options={taskOptions}
          onChange={handleTaskChange}
          placeholder={projectId ? "No task" : "Pick a project first"}
          clearLabel={projectId ? "No task" : undefined}
          emptyMessage={projectId ? "No matching tasks" : "Pick a project first"}
          ariaLabel="Task"
          disabled={!projectId || availableTasks.length === 0}
        />
      </label>

      {/* Note */}
      <label className="field">
        <span className="field-label">Note</span>
        <input
          className="field-input"
          value={note}
          onChange={(e) => handleNoteChange(e.target.value)}
          placeholder="Optional note"
        />
      </label>

      {/* Actions */}
      <div className="quick-timer-popup-actions">
        <Button size="sm" className="gap-1.5" onClick={handleSave}>
          <Square className="h-3.5 w-3.5" />
          Stop timer
        </Button>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={handleCancel}>
          <X className="h-3.5 w-3.5" />
          Cancel
        </Button>
      </div>
    </div>
  );
}

function DayTotalsPopup({
  anchorRef,
  dayTotalMs,
  weekTotalMs,
  onClose,
}: {
  anchorRef: RefObject<HTMLDivElement | null>;
  dayTotalMs: number;
  weekTotalMs: number;
  onClose: () => void;
}) {
  const popupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleMouseDown(event: MouseEvent) {
      const target = event.target as Node;
      if (anchorRef.current?.contains(target) || popupRef.current?.contains(target)) {
        return;
      }

      if (popupRef.current) {
        onClose();
      }
    }

    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [anchorRef, onClose]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div ref={popupRef} className="day-totals-popup" role="dialog" aria-label="Current time totals">
      <div className="day-totals-popup-row">
        <span className="day-totals-popup-label">Week total</span>
        <span className="day-totals-popup-value">{formatDurationShort(weekTotalMs)}</span>
      </div>
      <div className="day-totals-popup-row">
        <span className="day-totals-popup-label">Day total</span>
        <span className="day-totals-popup-value">{formatDurationShort(dayTotalMs)}</span>
      </div>
    </div>
  );
}

/* ── Global Timer Bar ──────────────────────────────────────────────── */

function GlobalTimerBar() {
  const state = useLocalState();
  const projects = useLocalProjects();
  const navigate = useNavigate();
  const [now, setNow] = useState(() => Date.now());
  const [popupOpen, setPopupOpen] = useState(false);
  const [dayTotalsOpen, setDayTotalsOpen] = useState(false);
  const quickTimerAnchorRef = useRef<HTMLDivElement>(null);
  const dayTotalsAnchorRef = useRef<HTMLDivElement>(null);

  const currentTimer = state.timers[0] ?? null;
  const today = todayIsoDate();
  const weekDates = useMemo(() => getIsoWeekDates(today), [today]);

  // Auto-close popup when timer stops (e.g. saved from the Time page)
  useEffect(() => {
    if (!currentTimer) {
      setPopupOpen(false);
    }
  }, [currentTimer]);

  useEffect(() => {
    if (!currentTimer) {
      return;
    }

    setNow(Date.now());
    const intervalId = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(intervalId);
  }, [currentTimer]);

  const runningDurationMs = currentTimer
    ? currentTimer.accumulatedDurationMs + Math.max(0, now - currentTimer.startedAt)
    : 0;

  const todayTotalMs = useMemo(() => {
    let total = state.timesheetEntries
      .filter((entry) => entry.localDate === today)
      .reduce((sum, entry) => sum + entry.durationMs, 0);

    if (currentTimer && currentTimer.localDate === today) {
      total += runningDurationMs;
    }

    return total;
  }, [state.timesheetEntries, today, currentTimer, runningDurationMs]);

  const weekTotalMs = useMemo(() => {
    const weekDateSet = new Set(weekDates);
    let total = state.timesheetEntries
      .filter((entry) => weekDateSet.has(entry.localDate))
      .reduce((sum, entry) => sum + entry.durationMs, 0);

    if (currentTimer && weekDateSet.has(currentTimer.localDate)) {
      total += runningDurationMs;
    }

    return total;
  }, [currentTimer, runningDurationMs, state.timesheetEntries, weekDates]);

  const timerProject = currentTimer
    ? projects.find((p) => p._id === currentTimer.projectId)
    : null;
  const timerTask = timerProject?.tasks.find((t) => t._id === currentTimer?.taskId);
  const timerProjectLabel = timerProject?.code?.trim() || timerProject?.name;
  const timerMeta = [timerProjectLabel, timerTask?.name].filter(Boolean).join(" \u00B7 ");

  function handlePlayClick() {
    localStore.startTimer({ localDate: todayIsoDate() });
    setPopupOpen(true);
  }

  function handleNewEntryClick() {
    void navigate({
      to: "/time/$date",
      params: { date: "today" },
      search: { entry: "new" } as never,
    });
  }

  function handleTimerPillClick() {
    setPopupOpen((prev) => !prev);
  }

  function handleDayTotalsClick() {
    setDayTotalsOpen((prev) => !prev);
  }

  const handlePopupClose = useCallback(() => {
    setPopupOpen(false);
  }, []);

  const handleDayTotalsClose = useCallback(() => {
    setDayTotalsOpen(false);
  }, []);

  return (
    <div className="global-timer">
      {currentTimer ? (
        <div
          ref={quickTimerAnchorRef}
          className={cn("quick-timer-popup-anchor", isDesktopShell && "desktop-no-drag")}
        >
          {timerMeta ? (
            <span className="global-timer-meta">{timerMeta}</span>
          ) : null}
          <div
            className="stat-pill stat-pill-active stat-pill-active-clickable"
            onClick={handleTimerPillClick}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") handleTimerPillClick();
            }}
          >
            <span className="status-dot status-dot-pulse" />
            <span className="stat-pill-value">{formatDurationShort(runningDurationMs)}</span>
          </div>
          {popupOpen ? (
            <QuickTimerPopup
              anchorRef={quickTimerAnchorRef}
              runningDurationMs={runningDurationMs}
              onClose={handlePopupClose}
            />
          ) : null}
        </div>
      ) : (
        <>
          <button
            className={cn("quick-timer-secondary-btn", isDesktopShell && "desktop-no-drag")}
            onClick={handleNewEntryClick}
            title="New entry"
            type="button"
          >
            <span className="quick-timer-btn-label">New entry</span>
          </button>
          <button
            className={cn("quick-timer-play-btn", isDesktopShell && "desktop-no-drag")}
            onClick={handlePlayClick}
            title="Start timer"
            type="button"
          >
            <Play className="h-3.5 w-3.5" />
            <span className="quick-timer-btn-label">Start timer</span>
          </button>
        </>
      )}
      <div
        ref={dayTotalsAnchorRef}
        className={cn("day-totals-popup-anchor", isDesktopShell && "desktop-no-drag")}
      >
        <button
          type="button"
          className="stat-pill global-timer-today stat-pill-clickable"
          onClick={handleDayTotalsClick}
          aria-label="Show day and week totals"
          aria-expanded={dayTotalsOpen}
        >
          <span className="stat-pill-label">Today</span>
          <span className="stat-pill-value">{formatDurationShort(todayTotalMs)}</span>
        </button>

        {dayTotalsOpen ? (
          <DayTotalsPopup
            anchorRef={dayTotalsAnchorRef}
            dayTotalMs={todayTotalMs}
            weekTotalMs={weekTotalMs}
            onClose={handleDayTotalsClose}
          />
        ) : null}
      </div>

    </div>
  );
}

/* ── App Shell ─────────────────────────────────────────────────────── */

export function AppShell() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const visibleNavItems = navItems;

  useApplyTheme();

  const renderCompactToggle = (extraClass?: string) => (
    <div
      className={cn(
        "harday-nav-compact-toggle",
        extraClass,
        isDesktopShell && "desktop-no-drag",
      )}
      role="navigation"
      aria-label="Primary navigation"
    >
      <Link
        to="/time/$date"
        params={{ date: "today" }}
        aria-label="Open timer"
        aria-current={isCompactTimerActive(pathname) ? "page" : undefined}
        className={cn(
          "harday-nav-compact-toggle-link",
          isCompactTimerActive(pathname) && "is-active",
        )}
      >
        <Timer className="h-3.5 w-3.5" />
      </Link>
      <Link
        to="/backlog"
        aria-label="Open backlog"
        aria-current={pathname.startsWith("/backlog") ? "page" : undefined}
        className={cn(
          "harday-nav-compact-toggle-link",
          pathname.startsWith("/backlog") && "is-active",
        )}
      >
        <ListTodo className="h-3.5 w-3.5" />
      </Link>
    </div>
  );

  return (
    <div className={cn("flex min-h-screen flex-col bg-background", isDesktopShell && "desktop-shell-app")}>
      <AzureDevOpsAutoSyncScheduler />
      {/* Top sticky nav */}
      <nav className={cn("harday-nav", isDesktopShell && "desktop-shell-nav desktop-drag-region")}>
        {isDesktopShell ? (
          <div className="desktop-shell-brand desktop-no-drag">
            <BrandLogo linked />
            {renderCompactToggle("harday-nav-compact-toggle-with-brand")}
          </div>
        ) : null}
        <div className={cn("harday-nav-inner", isDesktopShell && "desktop-shell-nav-inner")}>
          {renderCompactToggle("harday-nav-compact-toggle-inline")}

          <div className={cn("harday-nav-main", isDesktopShell && "desktop-shell-nav-main")}>
            {isDesktopShell ? null : (
              <div className={cn("harday-nav-brand", "desktop-no-drag")}>
                <BrandLogo linked />
                <div className="harday-nav-divider" />
              </div>
            )}
            <div className={cn("harday-nav-links", isDesktopShell && "desktop-no-drag")}>
              {visibleNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = isNavItemActive(pathname, item.to);
                return (
                  <Link
                    key={item.label}
                    to={item.to as never}
                    params={("params" in item ? item.params : undefined) as never}
                    className={cn(
                      "flex items-center gap-1.5 rounded px-2.5 py-1 text-[13px] transition",
                      isActive
                        ? "bg-[var(--surface-high)] text-foreground"
                        : "text-[var(--text-secondary)] hover:bg-[var(--surface-high)] hover:text-foreground",
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>

          <GlobalTimerBar />
        </div>
      </nav>

      {/* Page content */}
      <main className="flex-1">
        {pathname.startsWith("/settings") ? (
          <Outlet />
        ) : (
          <div className={cn("page-container", isDesktopShell && "desktop-page-container")}>
            <Outlet />
          </div>
        )}
      </main>
    </div>
  );
}
