import type { BudgetSlot, DayOfWeek } from "@/types/budget";
import { getCurrentDay, getCurrentTime } from "@/lib/utils/time";
import { createClient } from "@/lib/supabase/server";

export async function resolveActiveSlot(
  userId: string,
  now?: Date
): Promise<BudgetSlot | null> {
  const day = getCurrentDay(now) as DayOfWeek;
  const time = getCurrentTime(now);

  const supabase = await createClient();
  const { data: slots } = await supabase
    .from("budget_slots")
    .select("*")
    .eq("user_id", userId)
    .eq("hidden", false);

  if (!slots || slots.length === 0) return null;

  const matches = slots.filter(
    (slot: BudgetSlot) =>
      slot.days.includes(day) &&
      slot.start_time <= time &&
      slot.end_time > time
  );

  if (matches.length === 0) return null;

  if (matches.length === 1) return matches[0] as BudgetSlot;

  // Overlapping slots: pick the narrowest time window (most specific)
  matches.sort((a: BudgetSlot, b: BudgetSlot) => {
    const widthA = timeToMinutes(a.end_time) - timeToMinutes(a.start_time);
    const widthB = timeToMinutes(b.end_time) - timeToMinutes(b.start_time);
    return widthA - widthB;
  });

  return matches[0] as BudgetSlot;
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}
