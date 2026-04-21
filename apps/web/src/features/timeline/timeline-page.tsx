import { TimerPanel } from "@/features/timer/timer-panel";

export function TimelinePage({ date }: { date: string }) {
  return <TimerPanel date={date} />;
}
