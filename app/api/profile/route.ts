import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { UpdatePreferencesSchema } from "@/types/profile";
import { jsonError } from "@/lib/utils/validation";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return jsonError("Unauthorized", 401);

  const [profileResult, prefsResult] = await Promise.all([
    supabase.from("profiles").select("*").eq("user_id", user.id).single(),
    supabase
      .from("user_preferences")
      .select("*")
      .eq("user_id", user.id)
      .single(),
  ]);

  return NextResponse.json({
    profile: profileResult.data ?? null,
    preferences: prefsResult.data ?? null,
  });
}

export async function PUT(request: Request) {
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

  const parsed = UpdatePreferencesSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError(
      parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")
    );
  }

  const { data, error } = await supabase
    .from("user_preferences")
    .upsert(
      {
        user_id: user.id,
        ...parsed.data,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    )
    .select()
    .single();

  if (error) return jsonError(error.message, 500);

  return NextResponse.json(data);
}
