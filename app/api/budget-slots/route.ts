import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { CreateBudgetSlotSchema } from "@/types/budget";
import { jsonError } from "@/lib/utils/validation";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return jsonError("Unauthorized", 401);

  const { data, error } = await supabase
    .from("budget_slots")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  if (error) return jsonError(error.message, 500);

  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return jsonError("Unauthorized", 401);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body");
  }

  const parsed = CreateBudgetSlotSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError(
      parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")
    );
  }

  const { data: existing } = await supabase
    .from("budget_slots")
    .select("days, start_time, end_time")
    .eq("user_id", user.id)
    .eq("hidden", false);

  if (existing) {
    const newStart = parsed.data.start_time.slice(0, 5);
    const newEnd = parsed.data.end_time.slice(0, 5);
    for (const slot of existing) {
      const slotStart = (slot.start_time as string).slice(0, 5);
      const slotEnd = (slot.end_time as string).slice(0, 5);
      const sharedDays = parsed.data.days.filter((d: string) =>
        (slot.days as string[]).includes(d),
      );
      if (sharedDays.length > 0 && newStart < slotEnd && slotStart < newEnd) {
        return jsonError(
          `Overlaps with an existing slot on ${sharedDays.join(", ")}`,
          409,
        );
      }
    }
  }

  const { data, error } = await supabase
    .from("budget_slots")
    .insert({ user_id: user.id, ...parsed.data })
    .select()
    .single();

  if (error) return jsonError(error.message, 500);

  return NextResponse.json(data, { status: 201 });
}
