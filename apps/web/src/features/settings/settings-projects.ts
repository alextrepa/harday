import type ExcelJS from "exceljs";
import type { LocalProject } from "@/lib/local-store";
import { formatTaskImportName } from "@/features/projects/project-task-import-utils";

export type ProjectTransferStatus = "active" | "archived";

export interface ProjectTransferRow {
  project: string;
  code: string;
  color: string;
  status: ProjectTransferStatus;
  task: string;
  taskStatus: ProjectTransferStatus | "";
}

interface ProjectTransferOptions {
  projects: LocalProject[];
  projectIds: string[];
}

const workbookMimeType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const expectedImportHeaders = ["project", "code", "color", "status", "task", "task_status"] as const;

function toArrayBuffer(workbookBytes: ArrayBuffer | Uint8Array) {
  if (workbookBytes instanceof ArrayBuffer) {
    return workbookBytes.slice(0);
  }

  const normalized = new ArrayBuffer(workbookBytes.byteLength);
  new Uint8Array(normalized).set(workbookBytes);
  return normalized;
}

function normalizeImportHeader(value: unknown) {
  return formatTaskImportName(String(value ?? ""))
    .toLowerCase()
    .replace(/\s+/g, "_");
}

function normalizeImportCell(value: unknown) {
  return formatTaskImportName(String(value ?? ""));
}

function normalizeStatus(
  value: unknown,
  options?: { allowBlank?: boolean; fallback?: ProjectTransferStatus },
): ProjectTransferStatus | "" {
  const normalized = normalizeImportCell(value).toLowerCase();

  if (!normalized) {
    return options?.allowBlank ? "" : (options?.fallback ?? "active");
  }

  if (normalized === "active" || normalized === "archived") {
    return normalized;
  }

  throw new Error(`Invalid status "${normalized}". Expected active or archived.`);
}

export function buildProjectTransferRows({
  projects,
  projectIds,
}: ProjectTransferOptions): ProjectTransferRow[] {
  return projects
    .filter((project) => projectIds.includes(project._id))
    .flatMap<ProjectTransferRow>((project) => {
      if (project.tasks.length === 0) {
        return [
          {
            project: project.name,
            code: project.code ?? "",
            color: project.color,
            status: project.status,
            task: "",
            taskStatus: "",
          },
        ];
      }

      return project.tasks.map((task) => ({
        project: project.name,
        code: project.code ?? "",
        color: project.color,
        status: project.status,
        task: task.name,
        taskStatus: task.status,
      }));
    });
}

export async function createProjectTransferWorkbook(options: ProjectTransferOptions): Promise<ArrayBuffer> {
  const rows = buildProjectTransferRows(options);
  const ExcelJSModule = await import("exceljs");
  const workbook = new ExcelJSModule.default.Workbook();
  const sheet = workbook.addWorksheet("Projects");

  sheet.columns = [
    { header: "project", key: "project", width: 28 },
    { header: "code", key: "code", width: 16 },
    { header: "color", key: "color", width: 14 },
    { header: "status", key: "status", width: 14 },
    { header: "task", key: "task", width: 28 },
    { header: "task_status", key: "taskStatus", width: 16 },
  ];

  for (const row of rows) {
    sheet.addRow(row);
  }

  const workbookBytes = await workbook.xlsx.writeBuffer();
  return toArrayBuffer(workbookBytes as ArrayBuffer | Uint8Array);
}

export async function parseProjectTransferWorkbook(
  buffer: ArrayBuffer | Uint8Array,
): Promise<ProjectTransferRow[]> {
  let workbook: ExcelJS.Workbook;

  try {
    const ExcelJSModule = await import("exceljs");
    workbook = new ExcelJSModule.default.Workbook();
    await workbook.xlsx.load(toArrayBuffer(buffer));
  } catch (error) {
    throw new Error(
      error instanceof Error && error.message
        ? `Unable to read Excel file: ${error.message}`
        : "Unable to read Excel file.",
    );
  }

  const sheet = workbook.getWorksheet("Projects") ?? workbook.worksheets[0];
  if (!sheet) {
    throw new Error("The workbook does not contain any worksheets.");
  }

  const headerRow = sheet.getRow(1);
  const headers = expectedImportHeaders.map((_, index) => normalizeImportHeader(headerRow.getCell(index + 1).value));
  if (headers.join("|") !== expectedImportHeaders.join("|")) {
    throw new Error("The Projects sheet must contain the columns project, code, color, status, task, and task_status.");
  }

  const rows: ProjectTransferRow[] = [];

  for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    const project = normalizeImportCell(row.getCell(1).value);
    const code = normalizeImportCell(row.getCell(2).value);
    const color = normalizeImportCell(row.getCell(3).value);
    const rawStatus = row.getCell(4).value;
    const task = normalizeImportCell(row.getCell(5).value);
    const rawTaskStatus = row.getCell(6).value;

    const isBlankRow = !project && !code && !color && !normalizeImportCell(rawStatus) && !task && !normalizeImportCell(rawTaskStatus);
    if (isBlankRow) {
      continue;
    }

    if (!project) {
      throw new Error(`Row ${rowNumber} is invalid. A project name is required.`);
    }

    const status = normalizeStatus(rawStatus, { fallback: "active" }) as ProjectTransferStatus;
    const taskStatus = normalizeStatus(rawTaskStatus, { allowBlank: true });

    if (!task && taskStatus) {
      throw new Error(`Row ${rowNumber} is invalid. Task status requires a task name.`);
    }

    rows.push({
      project,
      code,
      color,
      status,
      task,
      taskStatus,
    });
  }

  return rows;
}

export function buildProjectTransferFilename() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `projects-${year}-${month}-${day}.xlsx`;
}

function toBlobPart(workbookBytes: ArrayBuffer | Uint8Array): ArrayBuffer {
  if (workbookBytes instanceof ArrayBuffer) {
    return workbookBytes.slice(0);
  }

  const normalized = new ArrayBuffer(workbookBytes.byteLength);
  new Uint8Array(normalized).set(workbookBytes);
  return normalized;
}

export function downloadProjectTransferWorkbook(workbookBytes: ArrayBuffer | Uint8Array, filename: string) {
  const blob = new Blob([toBlobPart(workbookBytes)], { type: workbookMimeType });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();

  window.setTimeout(() => {
    window.URL.revokeObjectURL(url);
  }, 1000);
}
