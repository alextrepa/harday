import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import type { LocalProject } from "@/lib/local-store";
import { DEFAULT_PROJECT_ICON } from "@/lib/project-icons";
import {
  buildProjectTransferRows,
  createProjectTransferWorkbook,
  parseProjectTransferWorkbook,
} from "./settings-projects";

const projects: LocalProject[] = [
  {
    _id: "project-1",
    name: "Project Mercury",
    code: "MER",
    color: "#123456",
    icon: DEFAULT_PROJECT_ICON,
    status: "active",
    tasks: [
      {
        _id: "task-1",
        name: "Feature Work",
        status: "active",
        createdAt: 1,
      },
      {
        _id: "task-2",
        name: "Archive Me",
        status: "archived",
        createdAt: 2,
        archivedAt: 3,
      },
    ],
  },
  {
    _id: "project-2",
    name: "Project Gemini",
    color: "#654321",
    icon: DEFAULT_PROJECT_ICON,
    status: "archived",
    tasks: [],
  },
];

describe("buildProjectTransferRows", () => {
  it("flattens selected projects into repeated project rows and preserves taskless projects", () => {
    expect(
      buildProjectTransferRows({
        projects,
        projectIds: ["project-1", "project-2"],
      }),
    ).toEqual([
      {
        project: "Project Mercury",
        code: "MER",
        color: "#123456",
        status: "active",
        task: "Feature Work",
        taskStatus: "active",
      },
      {
        project: "Project Mercury",
        code: "MER",
        color: "#123456",
        status: "active",
        task: "Archive Me",
        taskStatus: "archived",
      },
      {
        project: "Project Gemini",
        code: "",
        color: "#654321",
        status: "archived",
        task: "",
        taskStatus: "",
      },
    ]);
  });
});

describe("project workbook round-trip", () => {
  it("writes and re-parses the shared project import/export workbook shape", async () => {
    const workbookBytes = await createProjectTransferWorkbook({
      projects,
      projectIds: ["project-1", "project-2"],
    });

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(workbookBytes);
    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual(["Projects"]);

    const sheet = workbook.getWorksheet("Projects");
    expect(sheet).toBeTruthy();

    const rows: unknown[][] = [];
    for (let rowNumber = 1; rowNumber <= sheet!.rowCount; rowNumber += 1) {
      const row = sheet!.getRow(rowNumber);
      rows.push(
        Array.from({ length: 6 }, (_, index) => {
          const value = row.getCell(index + 1).value;
          return value ?? "";
        }),
      );
    }

    expect(rows).toEqual([
      ["project", "code", "color", "status", "task", "task_status"],
      ["Project Mercury", "MER", "#123456", "active", "Feature Work", "active"],
      ["Project Mercury", "MER", "#123456", "active", "Archive Me", "archived"],
      ["Project Gemini", "", "#654321", "archived", "", ""],
    ]);

    await expect(parseProjectTransferWorkbook(workbookBytes)).resolves.toEqual([
      {
        project: "Project Mercury",
        code: "MER",
        color: "#123456",
        status: "active",
        task: "Feature Work",
        taskStatus: "active",
      },
      {
        project: "Project Mercury",
        code: "MER",
        color: "#123456",
        status: "active",
        task: "Archive Me",
        taskStatus: "archived",
      },
      {
        project: "Project Gemini",
        code: "",
        color: "#654321",
        status: "archived",
        task: "",
        taskStatus: "",
      },
    ]);
  });
});
