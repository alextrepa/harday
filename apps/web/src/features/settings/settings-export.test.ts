import * as XLSX from "xlsx";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { LocalProject, LocalTimesheetEntry } from "@/lib/local-store";
import {
  buildTimesheetExportRows,
  createTimesheetExportWorkbook,
  downloadWorkbookFile,
} from "./settings-export";

const projects: LocalProject[] = [
  {
    _id: "project-1",
    name: "Project Mercury",
    color: "#123456",
    status: "active",
    tasks: [
      {
        _id: "task-1",
        name: "Feature Work",
        status: "active",
        createdAt: 1,
      },
    ],
  },
  {
    _id: "project-2",
    name: "Project Gemini",
    color: "#654321",
    status: "active",
    tasks: [],
  },
];

const entries: LocalTimesheetEntry[] = [
  {
    _id: "entry-1",
    localDate: "2026-04-10",
    projectId: "project-1",
    taskId: "task-1",
    label: "Feature Work",
    note: "Polish export UX",
    durationMs: 90 * 60 * 1000,
    sourceBlockIds: [],
    committedAt: 2,
  },
  {
    _id: "entry-2",
    localDate: "2026-04-11",
    projectId: "project-2",
    label: "Internal work",
    note: "",
    durationMs: 45 * 60 * 1000,
    sourceBlockIds: [],
    committedAt: 3,
  },
  {
    _id: "entry-3",
    localDate: "2026-04-12",
    projectId: "missing-project",
    label: "Ignored",
    note: "Outside selected range",
    durationMs: 30 * 60 * 1000,
    sourceBlockIds: [],
    committedAt: 1,
  },
];

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("buildTimesheetExportRows", () => {
  it("filters by date range and resolves project and task names", () => {
    expect(
      buildTimesheetExportRows({
        entries,
        projects,
        startDate: "2026-04-10",
        endDate: "2026-04-11",
      }),
    ).toEqual([
      {
        date: "2026-04-10",
        project: "Project Mercury",
        task: "Feature Work",
        note: "Polish export UX",
        hours: 1.5,
      },
      {
        date: "2026-04-11",
        project: "Project Gemini",
        task: "",
        note: "",
        hours: 0.75,
      },
    ]);
  });
});

describe("createTimesheetExportWorkbook", () => {
  it("creates an xlsx workbook with the requested columns in order", async () => {
    const workbookBytes = await createTimesheetExportWorkbook({
      entries,
      projects,
      startDate: "2026-04-10",
      endDate: "2026-04-11",
    });

    const workbook = XLSX.read(workbookBytes, { type: "array" });
    expect(workbook.SheetNames).toEqual(["Time Logs"]);

    const sheet = workbook.Sheets["Time Logs"];
    expect(sheet).toBeTruthy();
    expect(workbook.Sheets.Metadata).toBeUndefined();

    const rows = XLSX.utils.sheet_to_json<(string | number)[]>(sheet!, {
      header: 1,
      blankrows: false,
      raw: true,
    });

    expect(rows).toEqual([
      ["date", "project", "task", "note", "hours"],
      ["2026-04-10", "Project Mercury", "Feature Work", "Polish export UX", 1.5],
      ["2026-04-11", "Project Gemini", "", "", 0.75],
    ]);
  });

  it("does not include the orphaned metadata parts that triggered Excel repair warnings", async () => {
    const workbookBytes = await createTimesheetExportWorkbook({
      entries,
      projects,
      startDate: "2026-04-10",
      endDate: "2026-04-11",
    });

    const workbookArchive = XLSX.CFB.read(new Uint8Array(workbookBytes), { type: "array" });

    expect(XLSX.CFB.find(workbookArchive, "/xl/metadata.xml")).toBeNull();

    const workbookRels = XLSX.CFB.find(workbookArchive, "/xl/_rels/workbook.xml.rels");
    expect(workbookRels).toBeTruthy();
    expect(new TextDecoder().decode(workbookRels!.content)).not.toContain("sheetMetadata");

    const contentTypes = XLSX.CFB.find(workbookArchive, "/[Content_Types].xml");
    expect(contentTypes).toBeTruthy();
    expect(new TextDecoder().decode(contentTypes!.content)).not.toContain("/xl/metadata.xml");
  });
});

describe("downloadWorkbookFile", () => {
  it("waits until after the click before revoking the object url", () => {
    vi.useFakeTimers();

    const click = vi.fn();
    const remove = vi.fn();
    const appendChild = vi.fn();
    const createObjectURL = vi.fn(() => "blob:timelogs");
    const revokeObjectURL = vi.fn();

    vi.stubGlobal("document", {
      createElement: vi.fn(() => ({
        click,
        remove,
        href: "",
        download: "",
      })),
      body: {
        appendChild,
      },
    });
    vi.stubGlobal("window", {
      URL: {
        createObjectURL,
        revokeObjectURL,
      },
      setTimeout,
    });
    vi.stubGlobal("Blob", class MockBlob {
      parts: unknown[];
      options?: BlobPropertyBag;

      constructor(parts: unknown[], options?: BlobPropertyBag) {
        this.parts = parts;
        this.options = options;
      }
    });

    downloadWorkbookFile(new Uint8Array([1, 2, 3]), "timelogs.xlsx");

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(appendChild).toHaveBeenCalledTimes(1);
    expect(click).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).not.toHaveBeenCalled();

    vi.runAllTimers();

    expect(revokeObjectURL).toHaveBeenCalledWith("blob:timelogs");
  });
});
