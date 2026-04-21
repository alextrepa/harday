import * as XLSX from "xlsx";

const taskImportColumnIndex = 2;
const repeatedWhitespacePattern = /\s+/g;
const combiningMarkPattern = /[\u0300-\u036f]/g;
const taskImportHeader = "nom personnalise de la tache";

export type ProjectTaskImportResult = {
  importedCount: number;
  duplicateCount: number;
  blankCount: number;
  headerCount: number;
  importedNames: string[];
};

export function formatTaskImportName(value: string): string {
  return value.trim().replace(repeatedWhitespacePattern, " ");
}

export function normalizeTaskImportName(value: string): string {
  return formatTaskImportName(value)
    .normalize("NFD")
    .replace(combiningMarkPattern, "")
    .toLowerCase();
}

export function extractTaskNamesFromWorkbook(buffer: ArrayBuffer) {
  let workbook: XLSX.WorkBook;

  try {
    workbook = XLSX.read(buffer, { type: "array" });
  } catch (error) {
    throw new Error(
      error instanceof Error && error.message
        ? `Unable to read Excel file: ${error.message}`
        : "Unable to read Excel file.",
    );
  }

  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error("The workbook does not contain any worksheets.");
  }

  const firstSheet = workbook.Sheets[firstSheetName];
  if (!firstSheet) {
    throw new Error("The first worksheet could not be read.");
  }

  const rows = XLSX.utils.sheet_to_json<(string | number | boolean | null)[]>(firstSheet, {
    header: 1,
    raw: false,
    defval: "",
  });

  const taskNames: string[] = [];
  let blankCount = 0;
  let headerCount = 0;

  for (const row of rows) {
    const rawValue = row[taskImportColumnIndex];
    const displayName = formatTaskImportName(String(rawValue ?? ""));

    if (!displayName) {
      blankCount += 1;
      continue;
    }

    if (normalizeTaskImportName(displayName) === taskImportHeader) {
      headerCount += 1;
      continue;
    }

    taskNames.push(displayName);
  }

  return {
    taskNames,
    blankCount,
    headerCount,
  };
}
