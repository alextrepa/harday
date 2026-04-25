const repeatedWhitespacePattern = /\s+/g;
const combiningMarkPattern = /[\u0300-\u036f]/g;

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
