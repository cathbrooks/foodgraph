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

  // #region agent log
  fetch('http://127.0.0.1:7918/ingest/c3a3bfcf-a94d-45d2-a9fc-846a986bdef8',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'0dbf01'},body:JSON.stringify({sessionId:'0dbf01',location:'api/profile/route.ts:PUT:auth',message:'getUser result in PUT',data:{hasUser:!!user,userId:user?.id??null},timestamp:Date.now(),hypothesisId:'B'})}).catch(()=>{});
  console.log('[DEBUG-0dbf01] PUT /api/profile auth:', JSON.stringify({hasUser:!!user,userId:user?.id??null}));
  // #endregion

  if (!user) return jsonError("Unauthorized", 401);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body");
  }

  const parsed = UpdatePreferencesSchema.safeParse(body);

  // #region agent log
  fetch('http://127.0.0.1:7918/ingest/c3a3bfcf-a94d-45d2-a9fc-846a986bdef8',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'0dbf01'},body:JSON.stringify({sessionId:'0dbf01',location:'api/profile/route.ts:PUT:validation',message:'schema parse result',data:{success:parsed.success,errors:parsed.success?null:parsed.error.issues},timestamp:Date.now(),hypothesisId:'D'})}).catch(()=>{});
  console.log('[DEBUG-0dbf01] PUT /api/profile validation:', JSON.stringify({success:parsed.success,errors:parsed.success?null:parsed.error.issues}));
  // #endregion

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

  // #region agent log
  fetch('http://127.0.0.1:7918/ingest/c3a3bfcf-a94d-45d2-a9fc-846a986bdef8',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'0dbf01'},body:JSON.stringify({sessionId:'0dbf01',location:'api/profile/route.ts:PUT:upsert',message:'upsert result',data:{hasData:!!data,errorMsg:error?.message??null,errorCode:error?.code??null,errorDetails:error?.details??null},timestamp:Date.now(),hypothesisId:'C'})}).catch(()=>{});
  console.log('[DEBUG-0dbf01] PUT /api/profile upsert:', JSON.stringify({hasData:!!data,errorMsg:error?.message??null,errorCode:error?.code??null,errorDetails:error?.details??null}));
  // #endregion

  if (error) return jsonError(error.message, 500);

  return NextResponse.json(data);
}
