import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { handleChatRequest } from "@/lib/chat/chatOrchestrator";
import { ChatRequestSchema } from "@/types/chat";
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

  const parsed = ChatRequestSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError(
      parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")
    );
  }

  try {
    const response = await handleChatRequest(user.id, parsed.data);
    return NextResponse.json(response);
  } catch (err) {
    console.error("Chat request failed:", err);
    return jsonError(
      "Something went wrong while getting recommendations. Please try again.",
      500
    );
  }
}
