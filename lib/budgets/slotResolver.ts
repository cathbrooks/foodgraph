import type { BudgetSlot, DayOfWeek } from "@/types/budget";
import { getCurrentDay, getCurrentTime } from "@/lib/utils/time";
import { createClient } from "@/lib/supabase/server";

export async function resolveActiveSlot(
  userId: string,
  now?: Date,
  tz?: string
): Promise<BudgetSlot | null> {
  const day = getCurrentDay(now, tz) as DayOfWeek;
  const time = getCurrentTime(now, tz);

  // #region agent log
  fetch('http://127.0.0.1:7918/ingest/c3a3bfcf-a94d-45d2-a9fc-846a986bdef8',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'7190a2'},body:JSON.stringify({sessionId:'7190a2',location:'slotResolver.ts:resolveActiveSlot',message:'Server computed day and time',data:{day,time,tz:tz??'none',rawDate:new Date().toISOString(),rawHours:new Date().getHours(),rawDay:new Date().getDay()},timestamp:Date.now(),hypothesisId:'A',runId:'post-fix'})}).catch(()=>{});
  // #endregion

  const supabase = await createClient();
  const { data: slots, error: slotsError } = await supabase
    .from("budget_slots")
    .select("*")
    .eq("user_id", userId)
    .eq("hidden", false);

  // #region agent log
  fetch('http://127.0.0.1:7918/ingest/c3a3bfcf-a94d-45d2-a9fc-846a986bdef8',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'7190a2'},body:JSON.stringify({sessionId:'7190a2',location:'slotResolver.ts:afterDbQuery',message:'DB query results',data:{slotCount:slots?.length??0,slotsError:slotsError?.message??null,slots:slots?.map((s:BudgetSlot)=>({label:s.label,days:s.days,start_time:s.start_time,end_time:s.end_time,hidden:s.hidden}))},timestamp:Date.now(),hypothesisId:'D,E'})}).catch(()=>{});
  // #endregion

  if (!slots || slots.length === 0) return null;

  const matches = slots.filter(
    (slot: BudgetSlot) => {
      const dayMatch = slot.days.includes(day);
      const startMatch = slot.start_time <= time;
      const endMatch = slot.end_time > time;
      // #region agent log
      fetch('http://127.0.0.1:7918/ingest/c3a3bfcf-a94d-45d2-a9fc-846a986bdef8',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'7190a2'},body:JSON.stringify({sessionId:'7190a2',location:'slotResolver.ts:filterCheck',message:'Slot match details',data:{label:slot.label,slotDays:slot.days,currentDay:day,dayMatch,slotStart:slot.start_time,slotEnd:slot.end_time,currentTime:time,startMatch,endMatch,startComparison:`"${slot.start_time}" <= "${time}"`,endComparison:`"${slot.end_time}" > "${time}"`},timestamp:Date.now(),hypothesisId:'A,B,C'})}).catch(()=>{});
      // #endregion
      return dayMatch && startMatch && endMatch;
    }
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
