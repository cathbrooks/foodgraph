"use client";

import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import type { BudgetSlot } from "@/types/budget";

interface BudgetSlotCardProps {
  slot: BudgetSlot;
  onEdit?: () => void;
  onDelete?: () => void;
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

export function BudgetSlotCard({ slot, onEdit, onDelete }: BudgetSlotCardProps) {
  return (
    <Card className="flex items-start justify-between gap-4">
      <div className="space-y-1 min-w-0">
        <h3 className="font-semibold truncate">{slot.label}</h3>
        <p className="text-sm text-gray-500">{formatDays(slot.days)}</p>
        <p className="text-sm text-gray-500">
          {slot.start_time}\u2013{slot.end_time} &middot; ${slot.min_budget}\u2013${slot.max_budget}
        </p>
      </div>
      <div className="flex gap-2 shrink-0">
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
