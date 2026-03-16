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

  // #region agent log
  console.error('[debug-7bdc60] POST /api/chat auth:', JSON.stringify({hasUser:!!user,userId:user?.id??null,emailConfirmed:user?.email_confirmed_at??null}));
  fetch('http://127.0.0.1:7918/ingest/c3a3bfcf-a94d-45d2-a9fc-846a986bdef8',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'7bdc60'},body:JSON.stringify({sessionId:'7bdc60',location:'api/chat/route.ts:POST:auth',message:'chat POST getUser result',data:{hasUser:!!user,userId:user?.id??null,emailConfirmed:user?.email_confirmed_at??null},timestamp:Date.now(),hypothesisId:'H1'})}).catch(()=>{});
  // #endregion

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
