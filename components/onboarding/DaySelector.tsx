"use client";

import type { DayOfWeek } from "@/types/budget";

const DAYS: { value: DayOfWeek; short: string }[] = [
  { value: "monday", short: "Mon" },
  { value: "tuesday", short: "Tue" },
  { value: "wednesday", short: "Wed" },
  { value: "thursday", short: "Thu" },
  { value: "friday", short: "Fri" },
  { value: "saturday", short: "Sat" },
  { value: "sunday", short: "Sun" },
];

interface DaySelectorProps {
  selected: DayOfWeek[];
  onChange: (days: DayOfWeek[]) => void;
}

export function DaySelector({ selected, onChange }: DaySelectorProps) {
  function toggle(day: DayOfWeek) {
    if (selected.includes(day)) {
      onChange(selected.filter((d) => d !== day));
    } else {
      onChange([...selected, day]);
    }
  }

  return (
    <div className="flex gap-1.5">
      {DAYS.map((d) => (
        <button
          key={d.value}
          type="button"
          onClick={() => toggle(d.value)}
          className={`flex h-10 w-10 items-center justify-center rounded-full text-xs font-medium transition-colors ${
            selected.includes(d.value)
              ? "bg-black text-white"
              : "border border-gray-300 text-gray-600 hover:border-gray-400"
          }`}
        >
          {d.short}
        </button>
      ))}
    </div>
  );
}
