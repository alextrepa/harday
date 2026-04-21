import { useMemo, useState } from "react";
import { Download, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLocalState } from "@/lib/local-hooks";
import { todayIsoDate } from "@/lib/utils";
import {
  buildTimesheetExportFilename,
  buildTimesheetExportRows,
  createTimesheetExportWorkbook,
  downloadWorkbookFile,
} from "./settings-export";

function getAvailableDateRange(localDates: string[]) {
  const sortedDates = [...localDates].sort((left, right) => left.localeCompare(right));
  const fallbackDate = todayIsoDate();

  return {
    startDate: sortedDates[0] ?? fallbackDate,
    endDate: sortedDates.at(-1) ?? fallbackDate,
  };
}

function formatDecimalHours(value: number) {
  return value.toFixed(2).replace(/\.00$/, "");
}

export function SettingsExportPage() {
  const state = useLocalState();
  const availableRange = useMemo(
    () => getAvailableDateRange(state.timesheetEntries.map((entry) => entry.localDate)),
    [state.timesheetEntries],
  );
  const [startDate, setStartDate] = useState(availableRange.startDate);
  const [endDate, setEndDate] = useState(availableRange.endDate);
  const hasInvalidRange = startDate > endDate;

  const rows = useMemo(
    () =>
      hasInvalidRange
        ? []
        : buildTimesheetExportRows({
            entries: state.timesheetEntries,
            projects: state.projects,
            startDate,
            endDate,
          }),
    [endDate, hasInvalidRange, startDate, state.projects, state.timesheetEntries],
  );

  const totalHours = useMemo(
    () => rows.reduce((sum, row) => sum + row.hours, 0),
    [rows],
  );

  async function handleExport() {
    if (hasInvalidRange || rows.length === 0) {
      return;
    }

    const workbookBytes = await createTimesheetExportWorkbook({
      entries: state.timesheetEntries,
      projects: state.projects,
      startDate,
      endDate,
    });

    downloadWorkbookFile(workbookBytes, buildTimesheetExportFilename(startDate, endDate));
  }

  return (
    <div className="settings-sections">
      <section className="settings-section">
        <h2 className="settings-section-title">Export Time Logs</h2>
        <p className="settings-section-desc">
          Choose a day range and export committed time logs to Excel using the columns date, project, task,
          note, and hours.
        </p>

        <div className="settings-panel">
          <div className="flex items-start gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface-low)] p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--surface)] text-foreground">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">Excel workbook export</p>
              <p className="text-sm text-foreground/65">
                {state.timesheetEntries.length === 0
                  ? "No committed time logs are available yet."
                  : `Committed logs available from ${availableRange.startDate} to ${availableRange.endDate}.`}
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>From</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
                max={endDate}
              />
            </div>

            <div className="space-y-2">
              <Label>To</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
                min={startDate}
              />
            </div>
          </div>

          {hasInvalidRange ? (
            <div className="message-panel message-panel-warning">
              The start day must be on or before the end day.
            </div>
          ) : (
            <div className="flex flex-col gap-1 text-sm text-foreground/70">
              <p>
                {rows.length} {rows.length === 1 ? "entry" : "entries"} selected
              </p>
              <p>{formatDecimalHours(totalHours)} hours in decimal format will be exported.</p>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface-low)] p-4">
            <div className="space-y-1 text-sm text-foreground/65">
              <p>Filename: {buildTimesheetExportFilename(startDate, endDate)}</p>
              <p>Rows without an assigned project or task are exported with blank cells.</p>
            </div>

            <Button
              type="button"
              onClick={handleExport}
              disabled={hasInvalidRange || rows.length === 0}
            >
              <Download className="h-4 w-4" />
              Export to Excel
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
