import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { addDaysIsoDate, cn } from "@/lib/utils";

function dateAtNoon(localDate: string) {
  return new Date(`${localDate}T12:00:00`);
}

function formatPageTitle(localDate: string) {
  return new Intl.DateTimeFormat("en-CA", {
    weekday: "long",
    day: "2-digit",
    month: "short",
  }).format(dateAtNoon(localDate));
}

function formatWeekday(localDate: string) {
  return new Intl.DateTimeFormat("en-CA", { weekday: "short" }).format(dateAtNoon(localDate));
}

function formatDayNumber(localDate: string) {
  return new Intl.DateTimeFormat("en-CA", { day: "2-digit" }).format(dateAtNoon(localDate));
}

interface DayViewerCardProps {
  date: string;
  today: string;
  weekDates: string[];
  totalLabel: string;
  totalValue: string;
  getDayValue: (localDate: string) => string;
  onSelectDate: (localDate: string) => void;
  headerActions?: ReactNode;
}

export function DayViewerCard({
  date,
  today,
  weekDates,
  totalLabel,
  totalValue,
  getDayValue,
  onSelectDate,
  headerActions,
}: DayViewerCardProps) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <div className="relative border-b border-[var(--border)] bg-[var(--surface-high)] px-4 py-4 sm:px-5 sm:py-5 before:pointer-events-none before:absolute before:inset-0 before:bg-gradient-to-b before:from-indigo-500/[0.06] before:to-transparent">
          <div className="space-y-3 lg:hidden">
            <h1 className="min-w-0 text-[26px] font-semibold tracking-[-0.04em] text-foreground sm:text-[28px]">
              {formatPageTitle(date)}
            </h1>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => onSelectDate(addDaysIsoDate(date, -1))}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={() => onSelectDate(addDaysIsoDate(date, 1))}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
                {date !== today ? (
                  <Button variant="ghost" size="sm" onClick={() => onSelectDate(today)}>
                    Return to today
                  </Button>
                ) : null}
              </div>

            </div>
          </div>

          <div className="hidden items-center justify-between gap-4 lg:flex">
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => onSelectDate(addDaysIsoDate(date, -1))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => onSelectDate(addDaysIsoDate(date, 1))}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <div className="ml-1">
                <h1 className="text-[28px] font-semibold tracking-[-0.04em] text-foreground">
                  {formatPageTitle(date)}
                </h1>
              </div>
              {date !== today ? (
                <Button variant="ghost" size="sm" className="ml-1" onClick={() => onSelectDate(today)}>
                  Return to today
                </Button>
              ) : null}
            </div>

            {headerActions ? <div className="flex items-center">{headerActions}</div> : null}
          </div>
        </div>

        {/* Day grid: hidden on mobile, arrows suffice there */}
        <div className="hidden gap-px bg-[var(--border)] lg:grid lg:grid-cols-[repeat(7,minmax(0,1fr))_140px]">
          {weekDates.map((day) => {
            const isSelected = day === date;
            const isToday = day === today;

            return (
              <button
                key={day}
                type="button"
                onClick={() => onSelectDate(day)}
                className={cn(
                  "flex min-h-[84px] flex-col items-start justify-between bg-[var(--surface)] px-4 py-3 text-left transition hover:bg-[var(--surface-high)]",
                  isSelected ? "border-b-2 border-foreground bg-[var(--surface-high)]" : "border-b-2 border-transparent",
                )}
              >
                <div className="space-y-0.5">
                  <p className={cn("text-sm text-[var(--text-secondary)]", isToday ? "text-foreground" : "")}>
                    {formatWeekday(day)}
                  </p>
                  <p className="font-mono text-lg font-semibold text-foreground">{formatDayNumber(day)}</p>
                </div>
                <p className="font-mono text-sm text-[var(--text-secondary)]">{getDayValue(day)}</p>
              </button>
            );
          })}

          <div className="flex min-h-[84px] flex-col justify-between bg-[var(--surface)] px-4 py-3">
            <p className="text-sm text-[var(--text-secondary)]">{totalLabel}</p>
            <p className="font-mono text-lg font-semibold text-foreground">{totalValue}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
