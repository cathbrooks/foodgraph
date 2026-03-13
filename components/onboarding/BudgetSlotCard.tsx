"use client";

import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import type { BudgetSlot } from "@/types/budget";

interface BudgetSlotCardProps {
  slot: BudgetSlot;
  onEdit?: () => void;
  onDelete?: () => void;
  onToggleHidden?: () => void;
}

function formatDays(days: string[]): string {
  const short: Record<string, string> = {
    monday: "Mon",
    tuesday: "Tue",
    wednesday: "Wed",
    thursday: "Thu",
    friday: "Fri",
    saturday: "Sat",
    sunday: "Sun",
  };
  return days.map((d) => short[d] ?? d).join(", ");
}

function formatTime(t: string): string {
  const [hStr, mStr] = t.split(":");
  const h = parseInt(hStr, 10);
  const m = mStr ?? "00";
  const period = h >= 12 ? "p.m." : "a.m.";
  const hour12 = h % 12 || 12;
  return `${hour12}:${m.slice(0, 2)} ${period}`;
}

export function BudgetSlotCard({ slot, onEdit, onDelete, onToggleHidden }: BudgetSlotCardProps) {
  return (
    <Card className={`flex items-start justify-between gap-4${slot.hidden ? " opacity-50" : ""}`}>
      <div className="space-y-1 min-w-0">
        <h3 className="font-semibold truncate">{slot.label}</h3>
        <p className="text-sm text-gray-500">{formatDays(slot.days)}</p>
        <p className="text-sm text-gray-500">
          {formatTime(slot.start_time)}&ndash;{formatTime(slot.end_time)} &middot; ${slot.min_budget}&ndash;${slot.max_budget}
        </p>
      </div>
      <div className="flex gap-2 shrink-0">
        {onToggleHidden && (
          <Button variant="ghost" onClick={onToggleHidden} className="text-sm px-2 py-1">
            {slot.hidden ? "Unhide" : "Hide"}
          </Button>
        )}
        {onEdit && (
          <Button variant="ghost" onClick={onEdit} className="text-sm px-2 py-1">
            Edit
          </Button>
        )}
        {onDelete && (
          <Button variant="ghost" onClick={onDelete} className="text-sm px-2 py-1 text-red-600 hover:bg-red-50">
            Delete
          </Button>
        )}
      </div>
    </Card>
  );
}
