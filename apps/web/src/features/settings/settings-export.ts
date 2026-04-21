import ExcelJS from "exceljs";
import type { LocalProject, LocalTimesheetEntry } from "@/lib/local-store";

export interface TimesheetExportRow {
  date: string;
  project: string;
  task: string;
  note: string;
  hours: number;
}

interface TimesheetExportOptions {
  entries: LocalTimesheetEntry[];
  projects: LocalProject[];
  startDate: string;
  endDate: string;
}

const workbookMimeType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
function roundDecimalHours(durationMs: number) {
  return Math.round((durationMs / (60 * 60 * 1000)) * 100) / 100;
}

function resolveProject(projects: LocalProject[], projectId?: string) {
  return projects.find((project) => project._id === projectId);
}

export function buildTimesheetExportRows({
  entries,
  projects,
  startDate,
  endDate,
}: TimesheetExportOptions): TimesheetExportRow[] {
  return [...entries]
    .filter((entry) => entry.localDate >= startDate && entry.localDate <= endDate)
    .sort((left, right) => {
      if (left.localDate !== right.localDate) {
        return left.localDate.localeCompare(right.localDate);
      }

      if (left.committedAt !== right.committedAt) {
        return left.committedAt - right.committedAt;
      }

      return left._id.localeCompare(right._id);
    })
    .map((entry) => {
      const project = resolveProject(projects, entry.projectId);
      const task = project?.tasks.find((item) => item._id === entry.taskId);

      return {
        date: entry.localDate,
        project: project?.name ?? "",
        task: task?.name ?? "",
        note: entry.note ?? "",
        hours: roundDecimalHours(entry.durationMs),
      };
    });
}

function toArrayBuffer(workbookBytes: ArrayBuffer | Uint8Array) {
  if (workbookBytes instanceof ArrayBuffer) {
    return workbookBytes.slice(0);
  }

  const normalized = new ArrayBuffer(workbookBytes.byteLength);
  new Uint8Array(normalized).set(workbookBytes);
  return normalized;
}

export async function createTimesheetExportWorkbook(options: TimesheetExportOptions): Promise<ArrayBuffer> {
  const rows = buildTimesheetExportRows(options);
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Time Logs");

  sheet.columns = [
    { header: "date", key: "date", width: 12 },
    { header: "project", key: "project", width: 24 },
    { header: "task", key: "task", width: 24 },
    { header: "note", key: "note", width: 36 },
    { header: "hours", key: "hours", width: 12, style: { numFmt: "0.00" } },
  ];

  for (const row of rows) {
    sheet.addRow(row);
  }

  const workbookBytes = await workbook.xlsx.writeBuffer();
  return toArrayBuffer(workbookBytes as ArrayBuffer | Uint8Array);
}

export function buildTimesheetExportFilename(startDate: string, endDate: string) {
  return startDate === endDate
    ? `timelogs-${startDate}.xlsx`
    : `timelogs-${startDate}-to-${endDate}.xlsx`;
}

function toBlobPart(workbookBytes: ArrayBuffer | Uint8Array): ArrayBuffer {
  if (workbookBytes instanceof ArrayBuffer) {
    return workbookBytes.slice(0);
  }

  const normalized = new ArrayBuffer(workbookBytes.byteLength);
  new Uint8Array(normalized).set(workbookBytes);
  return normalized;
}

export function downloadWorkbookFile(workbookBytes: ArrayBuffer | Uint8Array, filename: string) {
  const blob = new Blob([toBlobPart(workbookBytes)], { type: workbookMimeType });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();

  // Safari can invalidate the download if the blob URL is revoked synchronously.
  window.setTimeout(() => {
    window.URL.revokeObjectURL(url);
  }, 1000);
}
