import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveActiveSlot } from "@/lib/budgets/slotResolver";
import { jsonError } from "@/lib/utils/validation";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return jsonError("Unauthorized", 401);

  const slot = await resolveActiveSlot(user.id);

  return NextResponse.json({ slot });
}
