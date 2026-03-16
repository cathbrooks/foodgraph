"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { DaySelector } from "./DaySelector";
import type { DayOfWeek, CreateBudgetSlotInput } from "@/types/budget";

interface BudgetSlotFormProps {
  initial?: Partial<CreateBudgetSlotInput>;
  onSubmit: (data: CreateBudgetSlotInput) => Promise<void>;
  onCancel?: () => void;
  submitLabel?: string;
  loading?: boolean;
  existingSlots?: { days: DayOfWeek[]; start_time: string; end_time: string }[];
}

const DISPLAY_HOURS = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const MINUTES = ["00", "15", "30", "45"];

function to12h(h24: number): { hour12: number; period: "AM" | "PM" } {
  const period: "AM" | "PM" = h24 >= 12 ? "PM" : "AM";
  const hour12 = h24 % 12 || 12;
  return { hour12, period };
}

function to24h(hour12: number, period: "AM" | "PM"): string {
  let h = hour12 % 12;
  if (period === "PM") h += 12;
  return String(h).padStart(2, "0");
}

function parse24(t: string): { h24: number; m: string } | null {
  if (!t) return null;
  const [hStr = "", m = ""] = t.split(":");
  const h24 = parseInt(hStr, 10);
  if (isNaN(h24)) return null;
  return { h24, m };
}

function TimeSelect({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const parsed = parse24(value);
  const { hour12, period } = parsed ? to12h(parsed.h24) : { hour12: 0, period: "AM" as const };
  const minute = parsed?.m || "";

  const selectClass =
    "rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black";

  function rebuild(h12: number, m: string, p: "AM" | "PM") {
    onChange(`${to24h(h12, p)}:${m || "00"}`);
  }

  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      <div className="flex gap-2">
        <select
          id={`${id}-hour`}
          value={parsed ? String(hour12) : ""}
          onChange={(e) => rebuild(Number(e.target.value), minute || "00", period)}
          className={`flex-1 ${selectClass}`}
        >
          <option value="" disabled>
            Hr
          </option>
          {DISPLAY_HOURS.map((hr) => (
            <option key={hr} value={String(hr)}>
              {hr}
            </option>
          ))}
        </select>
        <span className="flex items-center text-gray-500 font-medium">:</span>
        <select
          id={`${id}-min`}
          value={minute}
          onChange={(e) => rebuild(hour12 || 12, e.target.value, period)}
          className={`flex-1 ${selectClass}`}
        >
          <option value="" disabled>
            Min
          </option>
          {MINUTES.map((mn) => (
            <option key={mn} value={mn}>
              {mn}
            </option>
          ))}
        </select>
        <select
          id={`${id}-period`}
          value={period}
          onChange={(e) => rebuild(hour12 || 12, minute || "00", e.target.value as "AM" | "PM")}
          className={selectClass}
        >
          <option value="AM">a.m.</option>
          <option value="PM">p.m.</option>
        </select>
      </div>
    </div>
  );
}

function toHHMM(t: string): string {
  return t.slice(0, 5);
}

function timeRangesOverlap(
  a: { start: string; end: string },
  b: { start: string; end: string },
): boolean {
  const as = toHHMM(a.start), ae = toHHMM(a.end);
  const bs = toHHMM(b.start), be = toHHMM(b.end);
  return as < be && bs < ae;
}

function findOverlap(
  days: DayOfWeek[],
  startTime: string,
  endTime: string,
  existingSlots: { days: DayOfWeek[]; start_time: string; end_time: string }[],
): string | null {
  for (const slot of existingSlots) {
    const sharedDays = days.filter((d) => slot.days.includes(d));
    if (sharedDays.length === 0) continue;
    if (
      timeRangesOverlap(
        { start: startTime, end: endTime },
        { start: slot.start_time, end: slot.end_time },
      )
    ) {
      return `Overlaps with an existing slot on ${sharedDays.join(", ")}`;
    }
  }
  return null;
}

export function BudgetSlotForm({
  initial,
  onSubmit,
  onCancel,
  submitLabel = "Save",
  loading = false,
  existingSlots = [],
}: BudgetSlotFormProps) {
  const [label, setLabel] = useState(initial?.label ?? "");
  const [days, setDays] = useState<DayOfWeek[]>(initial?.days ?? []);
  const [startTime, setStartTime] = useState(initial?.start_time ?? "");
  const [endTime, setEndTime] = useState(initial?.end_time ?? "");
  const [minBudgetStr, setMinBudgetStr] = useState(String(initial?.min_budget ?? 0));
  const [maxBudgetStr, setMaxBudgetStr] = useState(String(initial?.max_budget ?? 0));
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!label.trim()) {
      setError("Give this slot a name.");
      return;
    }
    if (days.length === 0) {
      setError("Select at least one day.");
      return;
    }
    if (!startTime || !endTime) {
      setError("Set both start and end times.");
      return;
    }
    if (startTime === endTime) {
      setError("Start and end times cannot be the same.");
      return;
    }
    if (startTime > endTime) {
      setError("Start time must be before end time.");
      return;
    }
    const minBudget = parseFloat(minBudgetStr) || 0;
    const maxBudget = parseFloat(maxBudgetStr) || 0;

    if (maxBudget < minBudget) {
      setError("Max budget must be at least the min budget.");
      return;
    }

    const overlapMsg = findOverlap(days, startTime, endTime, existingSlots);
    if (overlapMsg) {
      setError(overlapMsg);
      return;
    }

    try {
      await onSubmit({
        label: label.trim(),
        days,
        start_time: startTime,
        end_time: endTime,
        min_budget: minBudget,
        max_budget: maxBudget,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      <Input
        id="slot-label"
        label="Slot name"
        placeholder="e.g. Weekday lunch"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        required
      />

      <div className="space-y-1">
        <label className="block text-sm font-medium text-gray-700">Days</label>
        <DaySelector selected={days} onChange={setDays} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <TimeSelect
          id="start-time"
          label="Start time"
          value={startTime}
          onChange={setStartTime}
        />
        <TimeSelect
          id="end-time"
          label="End time"
          value={endTime}
          onChange={setEndTime}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Input
          id="min-budget"
          label="Min budget ($)"
          type="number"
          min={0}
          step={1}
          value={minBudgetStr}
          onChange={(e) => setMinBudgetStr(e.target.value)}
          onBlur={() => {
            const n = parseFloat(minBudgetStr);
            if (isNaN(n) || n < 0) setMinBudgetStr("0");
          }}
          required
        />
        <Input
          id="max-budget"
          label="Max budget ($)"
          type="number"
          min={0}
          step={1}
          value={maxBudgetStr}
          onChange={(e) => setMaxBudgetStr(e.target.value)}
          onBlur={() => {
            const n = parseFloat(maxBudgetStr);
            if (isNaN(n) || n < 0) setMaxBudgetStr("0");
          }}
          required
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-3">
        <Button type="submit" disabled={loading} className="flex-1">
          {loading ? "Saving\u2026" : submitLabel}
        </Button>
        {onCancel && (
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
