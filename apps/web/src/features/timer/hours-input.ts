const MS_PER_MINUTE = 60_000;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;

export function formatDurationHoursInput(durationMs: number): string {
  const totalMinutes = Math.max(0, Math.round(durationMs / MS_PER_MINUTE));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function parseHoursInput(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const clockMatch = trimmed.match(/^(\d+)\s*:\s*(\d{1,2})$/);
  if (clockMatch) {
    const hours = Number(clockMatch[1]);
    const minutes = Number(clockMatch[2]);
    if (minutes >= 60) {
      return null;
    }

    return ((hours * 60) + minutes) * MS_PER_MINUTE;
  }

  const normalizedDecimal = trimmed.replace(",", ".");
  const hours = Number(normalizedDecimal);
  if (!Number.isFinite(hours) || hours < 0) {
    return null;
  }

  return Math.round(hours * MS_PER_HOUR);
}

export function normalizeHoursInput(value: string): string {
  const parsed = parseHoursInput(value);
  return parsed === null ? value.trim() : formatDurationHoursInput(parsed);
}
