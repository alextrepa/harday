import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import {
  RiDownloadLine as Download,
  RiFolderChartLine as FolderKanban,
  RiUploadLine as Upload,
} from "@remixicon/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLocalState } from "@/lib/local-hooks";
import { localStore } from "@/lib/local-store";
import { ProjectIcon } from "@/lib/project-icons";
import {
  buildProjectTransferFilename,
  createProjectTransferWorkbook,
  downloadProjectTransferWorkbook,
  parseProjectTransferWorkbook,
} from "./settings-projects";

function formatCount(value: number, singular: string, plural = `${singular}s`) {
  return `${value} ${value === 1 ? singular : plural}`;
}

function formatProjectImportSummary(result: {
  createdProjectCount: number;
  mergedProjectCount: number;
  addedTaskCount: number;
  updatedTaskCount: number;
}) {
  const parts = [];

  if (result.createdProjectCount > 0) {
    parts.push(formatCount(result.createdProjectCount, "project created"));
  }
  if (result.mergedProjectCount > 0) {
    parts.push(formatCount(result.mergedProjectCount, "project merged"));
  }
  if (result.addedTaskCount > 0) {
    parts.push(formatCount(result.addedTaskCount, "task added"));
  }
  if (result.updatedTaskCount > 0) {
    parts.push(formatCount(result.updatedTaskCount, "task updated"));
  }

  return parts.length > 0 ? `${parts.join(" · ")}.` : "No projects changed.";
}

export function SettingsProjectsPage() {
  const state = useLocalState();
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>(() => state.projects.map((project) => project._id));
  const [selectedImportFile, setSelectedImportFile] = useState<File | null>(null);
  const [statusMessage, setStatusMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setSelectedProjectIds((current) => {
      if (current.length === 0 && state.projects.length > 0) {
        return state.projects.map((project) => project._id);
      }

      const validProjectIds = new Set(state.projects.map((project) => project._id));
      const next = current.filter((projectId) => validProjectIds.has(projectId));
      return next.length === current.length ? current : next;
    });
  }, [state.projects]);

  const sortedProjects = useMemo(
    () =>
      [...state.projects].sort(
        (left, right) =>
          left.status.localeCompare(right.status) ||
          left.name.localeCompare(right.name),
      ),
    [state.projects],
  );

  const selectedProjects = useMemo(
    () => sortedProjects.filter((project) => selectedProjectIds.includes(project._id)),
    [selectedProjectIds, sortedProjects],
  );

  const selectedTaskCount = useMemo(
    () => selectedProjects.reduce((sum, project) => sum + project.tasks.length, 0),
    [selectedProjects],
  );

  async function handleExport() {
    if (selectedProjectIds.length === 0) {
      return;
    }

    const workbookBytes = await createProjectTransferWorkbook({
      projects: state.projects,
      projectIds: selectedProjectIds,
    });

    downloadProjectTransferWorkbook(workbookBytes, buildProjectTransferFilename());
  }

  function handleImportFileChange(event: ChangeEvent<HTMLInputElement>) {
    setSelectedImportFile(event.target.files?.[0] ?? null);
    setError("");
    setStatusMessage("");
  }

  async function handleImport() {
    if (!selectedImportFile) {
      return;
    }

    try {
      const workbookBytes = await selectedImportFile.arrayBuffer();
      const rows = await parseProjectTransferWorkbook(workbookBytes);
      const result = localStore.importProjectWorkbookRows(rows);
      setStatusMessage(formatProjectImportSummary(result));
      setError("");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to import the workbook.");
      setStatusMessage("");
    }
  }

  function toggleProjectSelection(projectId: string) {
    setSelectedProjectIds((current) =>
      current.includes(projectId)
        ? current.filter((id) => id !== projectId)
        : [...current, projectId],
    );
  }

  return (
    <div className="settings-sections">
      <section className="settings-section">
        <h2 className="settings-section-title">Project Import/Export</h2>
        <p className="settings-section-desc">
          Export one or more projects and their tasks to Excel, or import the same workbook format to
          merge projects by name.
        </p>

        <div className="settings-panel">
          <div className="flex items-start gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface-low)] p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--surface)] text-foreground">
              <FolderKanban className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">Excel workbook export</p>
              <p className="text-sm text-foreground/65">
                Select the projects to export. Each row repeats the project metadata and one task.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-sm text-foreground/70">
            <Badge className="bg-muted">{formatCount(selectedProjects.length, "project")} selected</Badge>
            <Badge className="bg-muted">{formatCount(selectedTaskCount, "task")} included</Badge>
          </div>

          {sortedProjects.length === 0 ? (
            <div className="message-panel">No projects are available yet.</div>
          ) : (
            <div className="space-y-3 rounded-lg border border-[var(--border)] bg-[var(--surface-low)] p-4">
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedProjectIds(sortedProjects.map((project) => project._id))}
                >
                  Select all
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedProjectIds([])}
                >
                  Clear
                </Button>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                {sortedProjects.map((project) => {
                  const isSelected = selectedProjectIds.includes(project._id);
                  return (
                    <label
                      key={project._id}
                      className="flex items-start gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3"
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleProjectSelection(project._id)}
                        className="mt-1 h-4 w-4"
                      />
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <ProjectIcon
                            icon={project.icon}
                            color={project.color}
                            className="size-3.5"
                          />
                          <span className="text-sm font-medium text-foreground">{project.name}</span>
                          {project.code ? <Badge className="bg-muted">{project.code}</Badge> : null}
                          <Badge className="bg-muted">{project.status}</Badge>
                        </div>
                        <p className="text-sm text-foreground/65">
                          {formatCount(project.tasks.length, "task")}
                        </p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface-low)] p-4">
            <div className="space-y-1 text-sm text-foreground/65">
              <p>Filename: {buildProjectTransferFilename()}</p>
              <p>Projects without tasks still export one row so they can be re-imported later.</p>
            </div>

            <Button type="button" onClick={handleExport} disabled={selectedProjectIds.length === 0}>
              <Download className="h-4 w-4" />
              Export to Excel
            </Button>
          </div>
        </div>

        <div className="settings-panel">
          <div className="flex items-start gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface-low)] p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--surface)] text-foreground">
              <Upload className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">Excel workbook import</p>
              <p className="text-sm text-foreground/65">
                Import the same workbook format to merge projects by name, update project metadata, and add
                missing tasks.
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
            <div className="space-y-2">
              <Label>Workbook</Label>
              <Input type="file" accept=".xlsx" onChange={handleImportFileChange} />
              <p className="text-sm text-foreground/65">
                {selectedImportFile ? selectedImportFile.name : "Choose a .xlsx file with a Projects sheet."}
              </p>
            </div>

            <Button type="button" onClick={handleImport} disabled={!selectedImportFile}>
              <Upload className="h-4 w-4" />
              Import workbook
            </Button>
          </div>

          {statusMessage ? <div className="message-panel">{statusMessage}</div> : null}
          {error ? <div className="message-panel message-panel-warning">{error}</div> : null}
        </div>
      </section>
    </div>
  );
}
