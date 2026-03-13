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

  const { data, error } = await supabase
    .from("budget_slots")
    .insert({ user_id: user.id, ...parsed.data })
    .select()
    .single();

  if (error) return jsonError(error.message, 500);

  return NextResponse.json(data, { status: 201 });
}
