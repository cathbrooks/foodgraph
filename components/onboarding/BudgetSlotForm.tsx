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
}

export function BudgetSlotForm({
  initial,
  onSubmit,
  onCancel,
  submitLabel = "Save",
  loading = false,
}: BudgetSlotFormProps) {
  const [label, setLabel] = useState(initial?.label ?? "");
  const [days, setDays] = useState<DayOfWeek[]>(initial?.days ?? []);
  const [startTime, setStartTime] = useState(initial?.start_time ?? "");
  const [endTime, setEndTime] = useState(initial?.end_time ?? "");
  const [minBudget, setMinBudget] = useState(initial?.min_budget ?? 0);
  const [maxBudget, setMaxBudget] = useState(initial?.max_budget ?? 0);
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
    if (startTime >= endTime) {
      setError("Start time must be before end time.");
      return;
    }
    if (maxBudget < minBudget) {
      setError("Max budget must be at least the min budget.");
      return;
    }

    try {
      await onSubmit({
        label: label.trim(),
        days,
        start_time: startTime.slice(0, 5),
        end_time: endTime.slice(0, 5),
        min_budget: minBudget,
        max_budget: maxBudget,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
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
        <Input
          id="start-time"
          label="Start time"
          type="time"
          value={startTime}
          onChange={(e) => setStartTime(e.target.value)}
          required
        />
        <Input
          id="end-time"
          label="End time"
          type="time"
          value={endTime}
          onChange={(e) => setEndTime(e.target.value)}
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Input
          id="min-budget"
          label="Min budget ($)"
          type="number"
          min={0}
          step={1}
          value={minBudget}
          onChange={(e) => setMinBudget(parseFloat(e.target.value) || 0)}
          required
        />
        <Input
          id="max-budget"
          label="Max budget ($)"
          type="number"
          min={0}
          step={1}
          value={maxBudget}
          onChange={(e) => setMaxBudget(parseFloat(e.target.value) || 0)}
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
