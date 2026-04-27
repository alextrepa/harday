import { useEffect, useMemo, useState } from "react";
import { RiSendPlaneLine as SendHorizontal } from "@remixicon/react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { DayViewerCard } from "@/components/day-viewer-card";
import { SubmitTimesheetModal } from "@/features/time/submit-timesheet-modal";
import { TimerPanel } from "@/features/timer/timer-panel";
import { TimeEntryModal } from "@/features/timer/time-entry-modal";
import { useLocalState } from "@/lib/local-hooks";
import { getIsoWeekDates, todayIsoDate } from "@/lib/utils";

function formatDuration(durationMs: number) {
  const totalMinutes = Math.max(0, Math.round(durationMs / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}:${String(minutes).padStart(2, "0")}`;
}

export function TimePage({ date }: { date: string }) {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as { entry?: string; timer?: string };
  const state = useLocalState();
  const [now, setNow] = useState(() => Date.now());
  const today = todayIsoDate();
  const weekDates = useMemo(() => getIsoWeekDates(date), [date]);
  const currentTimer = state.timers[0] ?? null;
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const modalEntryId = search.entry && search.entry !== "new" ? search.entry : undefined;
  const modalTimerId = search.timer;
  const modalOpen = search.entry === "new" || Boolean(modalEntryId) || Boolean(modalTimerId);

  useEffect(() => {
    if (!currentTimer) {
      return;
    }

    setNow(Date.now());
    const intervalId = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(intervalId);
  }, [currentTimer]);

  const totalsByDate = useMemo(() => {
    const totals = new Map(weekDates.map((day) => [day, 0]));

    for (const entry of state.timesheetEntries) {
      if (!totals.has(entry.localDate)) {
        continue;
      }

      totals.set(entry.localDate, (totals.get(entry.localDate) ?? 0) + entry.durationMs);
    }

    if (currentTimer && totals.has(currentTimer.localDate)) {
      const runningDuration = currentTimer.accumulatedDurationMs + Math.max(0, now - currentTimer.startedAt);
      totals.set(currentTimer.localDate, (totals.get(currentTimer.localDate) ?? 0) + runningDuration);
    }

    return totals;
  }, [currentTimer, now, state.timesheetEntries, weekDates]);

  const weekTotalMs = Array.from(totalsByDate.values()).reduce((sum, value) => sum + value, 0);

  function goToDate(nextDate: string) {
    navigate({ to: "/time/$date", params: { date: nextDate } });
  }

  function closeModal() {
    void navigate({
      to: "/time/$date",
      params: { date },
      search: {} as never,
      replace: true,
    });
  }

  function openModal(target?: { entryId?: string; timerId?: string }) {
    void navigate({
      to: "/time/$date",
      params: { date },
      search: target?.timerId
        ? ({ entry: target.entryId, timer: target.timerId } as never)
        : ({ entry: target?.entryId ?? "new" } as never),
    });
  }

  return (
    <div className="time-page-stack">
      <DayViewerCard
        date={date}
        today={today}
        weekDates={weekDates}
        totalLabel="Week total"
        totalValue={formatDuration(weekTotalMs)}
        getDayValue={(day) => formatDuration(totalsByDate.get(day) ?? 0)}
        onSelectDate={goToDate}
        headerActions={
          <button
            type="button"
            className="day-viewer-submit-pill"
            aria-label="Submit timesheet"
            onClick={() => setIsSubmitModalOpen(true)}
          >
            <SendHorizontal className="h-4 w-4" />
            <span>Submit</span>
          </button>
        }
      />

      <TimerPanel date={date} onOpenEntry={openModal} />

      {modalOpen ? (
        <TimeEntryModal date={date} entryId={modalEntryId} timerId={modalTimerId} onClose={closeModal} />
      ) : null}
      {isSubmitModalOpen ? <SubmitTimesheetModal weekDates={weekDates} onClose={() => setIsSubmitModalOpen(false)} /> : null}
    </div>
  );
}
