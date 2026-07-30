import { describe, expect, it } from "vitest";
import type {
  LocalProject,
  LocalProjectDraft,
  LocalProjectTask,
  LocalProjectTaskDraft,
} from "@/domain/local-state";
import { DEFAULT_PROJECT_ICON } from "@/domain/projects/project-icon";
import {
  importProjectTasks,
  importProjectWorkbookRows,
} from "@/domain/projects/project-import";

function createFactories() {
  let nextId = 1;

  const createTask = (draft: LocalProjectTaskDraft): LocalProjectTask => ({
    _id: `task-${nextId++}`,
    name: draft.name,
    status: draft.status ?? "active",
    createdAt: 100,
    archivedAt: draft.status === "archived" ? 100 : undefined,
    billable: draft.billable ?? true,
    budgetMs: draft.budgetMs,
    adjustmentMs: draft.adjustmentMs,
  });

  const createProject = (draft: LocalProjectDraft): LocalProject => ({
    _id: `project-${nextId++}`,
    name: draft.name,
    displayName: draft.displayName ?? draft.name,
    code: draft.code,
    color: draft.color,
    icon: DEFAULT_PROJECT_ICON,
    status: draft.status ?? "active",
    tasks: (draft.tasks ?? []).map(createTask),
  });

  return {
    createProject,
    createTask,
    now: () => 500,
  };
}

describe("importProjectTasks", () => {
  it("adds normalized unique names and reports duplicates", () => {
    const project = createFactories().createProject({
      name: "Mercury",
      color: "#123456",
      tasks: [{ name: "Design" }],
    });

    const operation = importProjectTasks(
      [project],
      project._id,
      [" Build ", "build", "Désign", ""],
      createFactories(),
    );

    expect(operation.result).toEqual({
      importedCount: 1,
      duplicateCount: 2,
      blankCount: 1,
      headerCount: 0,
      importedNames: ["Build"],
    });
    expect(operation.projects[0]?.tasks.map((task) => task.name)).toEqual([
      "Design",
      "Build",
    ]);
  });

  it("rejects an unknown project", () => {
    expect(() =>
      importProjectTasks([], "missing", ["Build"], createFactories()),
    ).toThrow("Project not found.");
  });
});

describe("importProjectWorkbookRows", () => {
  it("merges matching projects and creates missing projects deterministically", () => {
    const factories = createFactories();
    const existingProject = factories.createProject({
      name: "Mercury",
      color: "#123456",
      tasks: [{ name: "Design", budgetMs: 60 * 60 * 1000 }],
    });

    const operation = importProjectWorkbookRows(
      [existingProject],
      [
        {
          project: "Mércury",
          code: "MER",
          color: "#654321",
          status: "archived",
          task: "Design",
          taskStatus: "archived",
          billable: "non_billable",
          budgetHours: 2,
          adjustmentHours: -0.5,
        },
        {
          project: "Gemini",
          code: "",
          color: "",
          status: "active",
          task: "Build",
          taskStatus: "active",
          billable: "billable",
          budgetHours: "",
          adjustmentHours: "",
        },
      ],
      factories,
    );

    expect(operation.result).toEqual({
      createdProjectCount: 1,
      mergedProjectCount: 1,
      addedTaskCount: 1,
      updatedTaskCount: 1,
    });
    expect(operation.projects).toHaveLength(2);
    expect(operation.projects[0]).toMatchObject({
      name: "Mércury",
      code: "MER",
      color: "#654321",
      status: "archived",
      tasks: [
        {
          name: "Design",
          status: "archived",
          archivedAt: 500,
          billable: false,
          budgetMs: 2 * 60 * 60 * 1000,
          adjustmentMs: -30 * 60 * 1000,
        },
      ],
    });
    expect(operation.projects[1]).toMatchObject({
      name: "Gemini",
      color: "#3d5a80",
      status: "active",
      tasks: [{ name: "Build" }],
    });
  });
});
