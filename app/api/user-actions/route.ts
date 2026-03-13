import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { CreateUserActionSchema } from "@/types/action";
import { jsonError } from "@/lib/utils/validation";

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

  const parsed = CreateUserActionSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError(
      parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")
    );
  }

  const { data, error } = await supabase
    .from("user_actions")
    .insert({ user_id: user.id, ...parsed.data })
    .select()
    .single();

  if (error) return jsonError(error.message, 500);

  return NextResponse.json(data, { status: 201 });
}
