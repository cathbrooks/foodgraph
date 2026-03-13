import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { UpdateBudgetSlotSchema } from "@/types/budget";
import { jsonError } from "@/lib/utils/validation";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
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

  const parsed = UpdateBudgetSlotSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError(
      parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")
    );
  }

  if (parsed.data.hidden === false) {
    const { data: current } = await supabase
      .from("budget_slots")
      .select("days, start_time, end_time")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (current) {
      const days = (parsed.data.days ?? current.days) as string[];
      const startTime = (parsed.data.start_time ?? current.start_time) as string;
      const endTime = (parsed.data.end_time ?? current.end_time) as string;
      const newStart = startTime.slice(0, 5);
      const newEnd = endTime.slice(0, 5);

      const { data: others } = await supabase
        .from("budget_slots")
        .select("days, start_time, end_time")
        .eq("user_id", user.id)
        .eq("hidden", false)
        .neq("id", id);

      if (others) {
        for (const slot of others) {
          const slotStart = (slot.start_time as string).slice(0, 5);
          const slotEnd = (slot.end_time as string).slice(0, 5);
          const sharedDays = days.filter((d) =>
            (slot.days as string[]).includes(d),
          );
          if (sharedDays.length > 0 && newStart < slotEnd && slotStart < newEnd) {
            return jsonError(
              `Cannot unhide: overlaps with an active slot on ${sharedDays.join(", ")}`,
              409,
            );
          }
        }
      }
    }
  }

  const { data, error } = await supabase
    .from("budget_slots")
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) return jsonError(error.message, 500);
  if (!data) return jsonError("Not found", 404);

  return NextResponse.json(data);
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return jsonError("Unauthorized", 401);

  const { error } = await supabase
    .from("budget_slots")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return jsonError(error.message, 500);

  return new NextResponse(null, { status: 204 });
}
