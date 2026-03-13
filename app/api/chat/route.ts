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
    // #region agent log
    fetch('http://127.0.0.1:7918/ingest/c3a3bfcf-a94d-45d2-a9fc-846a986bdef8',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'e1907f'},body:JSON.stringify({sessionId:'e1907f',location:'route.ts:success',message:'API returning 200',data:{hasResponse:!!response,responseKeys:response?Object.keys(response):null},timestamp:Date.now(),hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    return NextResponse.json(response);
  } catch (err) {
    // #region agent log
    fetch('http://127.0.0.1:7918/ingest/c3a3bfcf-a94d-45d2-a9fc-846a986bdef8',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'e1907f'},body:JSON.stringify({sessionId:'e1907f',location:'route.ts:catch-500',message:'API returning 500',data:{error:String(err),stack:(err as Error)?.stack},timestamp:Date.now(),hypothesisId:'D'})}).catch(()=>{});
    // #endregion
    console.error("Chat request failed:", err);
    return jsonError(
      "Something went wrong while getting recommendations. Please try again.",
      500
    );
  }
}
