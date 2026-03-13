import type { DayOfWeek } from "@/types/budget";

const DAY_MAP: DayOfWeek[] = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

export function getCurrentDay(now?: Date): DayOfWeek {
  const d = now ?? new Date();
  return DAY_MAP[d.getDay()];
}

export function getCurrentTime(now?: Date): string {
  const d = now ?? new Date();
  const h = d.getHours().toString().padStart(2, "0");
  const m = d.getMinutes().toString().padStart(2, "0");
  return `${h}:${m}`;
}
