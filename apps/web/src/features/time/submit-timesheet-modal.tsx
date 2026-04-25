import { useEffect, useMemo, useRef, useState } from "react";
import { RiCloseLine as X } from "@remixicon/react";
import { Button } from "@/components/ui/button";
import { useLocalProjects, useLocalState } from "@/lib/local-hooks";
import { localStore, type LocalTimesheetEntry } from "@/lib/local-store";
import { cn } from "@/lib/utils";

function formatDuration(durationMs: number) {
  const totalMinutes = Math.max(0, Math.round(durationMs / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}:${String(minutes).padStart(2, "0")}`;
}

function formatDayHeading(localDate: string) {
  return new Intl.DateTimeFormat("en-CA", {
    weekday: "long",
    month: "short",
    day: "numeric",
  }).format(new Date(`${localDate}T12:00:00`));
}

function formatWeekRange(weekDates: string[]) {
  const firstDay = weekDates[0];
  const lastDay = weekDates.at(-1);
  if (!firstDay || !lastDay) {
    return "";
  }

  const formatter = new Intl.DateTimeFormat("en-CA", {
    month: "short",
    day: "numeric",
  });

  return `${formatter.format(new Date(`${firstDay}T12:00:00`))} to ${formatter.format(new Date(`${lastDay}T12:00:00`))}`;
}

function SelectionCheckbox({
  checked,
  indeterminate,
  onChange,
  ariaLabel,
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: (checked: boolean) => void;
  ariaLabel: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!inputRef.current) {
      return;
    }

    inputRef.current.indeterminate = indeterminate ?? false;
  }, [indeterminate]);

  return (
    <input
      ref={inputRef}
      type="checkbox"
      className="submit-timesheet-checkbox"
      checked={checked}
      aria-label={ariaLabel}
      onChange={(event) => onChange(event.target.checked)}
    />
  );
}

interface SubmitTimesheetModalProps {
  weekDates: string[];
  onClose: () => void;
}

export function SubmitTimesheetModal({ weekDates, onClose }: SubmitTimesheetModalProps) {
  const state = useLocalState();
  const projects = useLocalProjects();
  const overlayRef = useRef<HTMLDivElement>(null);
  const initializedSelectionRef = useRef(false);
  const [selectedEntryIds, setSelectedEntryIds] = useState<string[]>([]);

  const weekDateSet = useMemo(() => new Set(weekDates), [weekDates]);
  const submittedWeekEntryIds = useMemo(
    () =>
      new Set(
        state.timesheetEntries
          .filter((entry) => weekDateSet.has(entry.localDate) && entry.submittedAt)
          .map((entry) => entry._id),
      ),
    [state.timesheetEntries, weekDateSet],
  );
  const groups = useMemo(
    () =>
      weekDates
        .map((localDate) => {
          const entries = state.timesheetEntries
            .filter((entry) => entry.localDate === localDate && !entry.submittedAt)
            .sort((left, right) => right.committedAt - left.committedAt);

          return {
            localDate,
            entries,
            totalMs: entries.reduce((sum, entry) => sum + entry.durationMs, 0),
          };
        })
        .filter((group) => group.entries.length > 0),
    [state.timesheetEntries, weekDates],
  );
  const visibleEntryIds = useMemo(() => groups.flatMap((group) => group.entries.map((entry) => entry._id)), [groups]);
  const visibleEntryIdsKey = useMemo(() => visibleEntryIds.join("|"), [visibleEntryIds]);
  const selectedEntryIdSet = useMemo(() => new Set(selectedEntryIds), [selectedEntryIds]);
  const selectedCount = selectedEntryIds.length;
  const submittedWeekCount = submittedWeekEntryIds.size;
  const selectedDurationMs = useMemo(
    () =>
      groups.reduce(
        (sum, group) =>
          sum + group.entries.reduce((groupSum, entry) => groupSum + (selectedEntryIdSet.has(entry._id) ? entry.durationMs : 0), 0),
        0,
      ),
    [groups, selectedEntryIdSet],
  );
  useEffect(() => {
    const nextVisibleEntryIdSet = new Set(visibleEntryIds);
    setSelectedEntryIds((current) => {
      const nextSelectedIds = current.filter((entryId) => nextVisibleEntryIdSet.has(entryId));
      if (!initializedSelectionRef.current) {
        initializedSelectionRef.current = true;
        return visibleEntryIds;
      }

      return nextSelectedIds;
    });
  }, [visibleEntryIds, visibleEntryIdsKey]);

  useEffect(() => {
    function handleMouseDown(event: MouseEvent) {
      if (overlayRef.current === event.target) {
        onClose();
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  function replaceSelection(nextEntryIds: string[]) {
    const nextIdSet = new Set(nextEntryIds);
    setSelectedEntryIds(visibleEntryIds.filter((entryId) => nextIdSet.has(entryId)));
  }

  function setGroupSelection(entries: LocalTimesheetEntry[], checked: boolean) {
    const groupIds = new Set(entries.map((entry) => entry._id));
    setSelectedEntryIds((current) => {
      const nextSelectedSet = new Set(
        checked ? [...current, ...entries.map((entry) => entry._id)] : current.filter((entryId) => !groupIds.has(entryId)),
      );
      return visibleEntryIds.filter((entryId) => nextSelectedSet.has(entryId));
    });
  }

  function handleSubmit() {
    if (selectedEntryIds.length === 0) {
      return;
    }

    localStore.markTimesheetEntriesSubmitted(selectedEntryIds);
  }

  return (
    <div ref={overlayRef} className="time-entry-modal-overlay">
      <div className="submit-timesheet-modal">
        <div className="submit-timesheet-modal-header">
          <div className="submit-timesheet-modal-title-wrap">
            <span className="submit-timesheet-modal-title">Submit timesheet</span>
            <span className="submit-timesheet-modal-subtitle">Review and select the current week&apos;s unsubmitted entries.</span>
          </div>
          <button type="button" className="time-entry-modal-close" onClick={onClose} aria-label="Close submit timesheet modal">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="submit-timesheet-toolbar">
          <div className="submit-timesheet-toolbar-copy">
            <span className="submit-timesheet-toolbar-label">Week of {formatWeekRange(weekDates)}</span>
            <span className="submit-timesheet-toolbar-value">
              {selectedCount} selected · {formatDuration(selectedDurationMs)}
            </span>
          </div>

          <div className="submit-timesheet-toolbar-badges">
            <span className="submit-timesheet-toolbar-badge">{visibleEntryIds.length} unsubmitted entries</span>
            <span className="submit-timesheet-toolbar-badge">{submittedWeekCount} submitted</span>
            <span className="submit-timesheet-toolbar-badge">{groups.length} days</span>
          </div>

          <div className="submit-timesheet-toolbar-actions">
            <Button
              variant="outline"
              size="sm"
              disabled={visibleEntryIds.length === 0}
              onClick={() => replaceSelection(visibleEntryIds)}
            >
              Select All
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={visibleEntryIds.length === 0}
              onClick={() => replaceSelection(visibleEntryIds)}
            >
              Select Unsubmitted
            </Button>
            <Button variant="outline" size="sm" disabled={selectedEntryIds.length === 0} onClick={() => replaceSelection([])}>
              Clear Selection
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={submittedWeekCount === 0}
              onClick={() => setSelectedEntryIds((current) => current.filter((entryId) => !submittedWeekEntryIds.has(entryId)))}
            >
              Clear Submitted
            </Button>
          </div>
        </div>

        <div className="submit-timesheet-groups">
          {groups.length === 0 ? (
            <div className="submit-timesheet-empty">
              All entries in this week are already submitted.
            </div>
          ) : (
            groups.map((group) => {
              const daySelectedCount = group.entries.filter((entry) => selectedEntryIdSet.has(entry._id)).length;
              const isDayChecked = daySelectedCount === group.entries.length;
              const isDayIndeterminate = daySelectedCount > 0 && !isDayChecked;
              return (
                <section key={group.localDate} className="submit-timesheet-group">
                  <div className="submit-timesheet-group-header">
                    <div className="submit-timesheet-group-main">
                      <div className="submit-timesheet-group-copy">
                        <h3 className="submit-timesheet-group-title">{formatDayHeading(group.localDate)}</h3>
                        <p className="submit-timesheet-group-meta">
                          {group.entries.length} entries · {formatDuration(group.totalMs)}
                        </p>
                      </div>
                    </div>

                    <div className="submit-timesheet-group-actions">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isDayChecked}
                        onClick={() => setGroupSelection(group.entries, true)}
                      >
                        Check All
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={!isDayChecked && !isDayIndeterminate}
                        onClick={() => setGroupSelection(group.entries, false)}
                      >
                        Uncheck All
                      </Button>
                    </div>
                  </div>

                  <div className="submit-timesheet-entry-list">
                    {group.entries.map((entry) => {
                      const project = projects.find((item) => item._id === entry.projectId);
                      const task = project?.tasks.find((item) => item._id === entry.taskId);

                      return (
                        <label key={entry._id} className={cn("submit-timesheet-entry", selectedEntryIdSet.has(entry._id) && "is-selected")}>
                          <SelectionCheckbox
                            checked={selectedEntryIdSet.has(entry._id)}
                            onChange={(checked) => setGroupSelection([entry], checked)}
                            ariaLabel={`Select ${project?.name ?? "No project"} ${task?.name ?? ""}`.trim()}
                          />
                          <div className="submit-timesheet-entry-body">
                            <div className="submit-timesheet-entry-primary">
                              <span className="entry-project-dot" style={{ background: project?.color ?? "#3b82f6" }} />
                              <span className="submit-timesheet-entry-project">{project?.name ?? "No project"}</span>
                            </div>
                            {task?.name ? <div className="submit-timesheet-entry-secondary">{task.name}</div> : null}
                            {entry.note ? <div className="submit-timesheet-entry-note">{entry.note}</div> : null}
                          </div>
                          <div className="submit-timesheet-entry-hours">{formatDuration(entry.durationMs)}</div>
                        </label>
                      );
                    })}
                  </div>
                </section>
              );
            })
          )}
        </div>

        <div className="submit-timesheet-modal-actions">
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          <Button onClick={handleSubmit} disabled={selectedEntryIds.length === 0}>
            Submit
          </Button>
        </div>
      </div>
    </div>
  );
}
