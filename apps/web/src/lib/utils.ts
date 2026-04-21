import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export function todayIsoDate() {
  return new Intl.DateTimeFormat("en-CA").format(new Date());
}

export function startOfWeekIsoDate() {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  now.setDate(now.getDate() + diff);
  return new Intl.DateTimeFormat("en-CA").format(now);
}

function localDateAtNoon(localDate: string) {
  return new Date(`${localDate}T12:00:00`);
}

function formatIsoDate(date: Date) {
  return new Intl.DateTimeFormat("en-CA").format(date);
}

export function addDaysIsoDate(localDate: string, days: number) {
  const next = localDateAtNoon(localDate);
  next.setDate(next.getDate() + days);
  return formatIsoDate(next);
}

export function startOfIsoWeek(localDate: string) {
  const next = localDateAtNoon(localDate);
  const day = next.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  next.setDate(next.getDate() + diff);
  return formatIsoDate(next);
}

export function getIsoWeekDates(localDate: string) {
  const start = startOfIsoWeek(localDate);
  return Array.from({ length: 7 }, (_, index) => addDaysIsoDate(start, index));
}
