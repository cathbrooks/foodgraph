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

export function getCurrentDay(now?: Date, tz?: string): DayOfWeek {
  const d = now ?? new Date();
  if (tz) {
    const dayName = d
      .toLocaleDateString("en-US", { timeZone: tz, weekday: "long" })
      .toLowerCase() as DayOfWeek;
    if (DAY_MAP.includes(dayName)) return dayName;
  }
  return DAY_MAP[d.getDay()];
}

export function getCurrentTime(now?: Date, tz?: string): string {
  const d = now ?? new Date();
  if (tz) {
    const parts = d.toLocaleString("en-US", {
      timeZone: tz,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
    const match = parts.match(/(\d{2}):(\d{2}):(\d{2})/);
    if (match) return `${match[1]}:${match[2]}:${match[3]}`;
  }
  const h = d.getHours().toString().padStart(2, "0");
  const m = d.getMinutes().toString().padStart(2, "0");
  const s = d.getSeconds().toString().padStart(2, "0");
  return `${h}:${m}:${s}`;
}
