import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { UpdatePreferencesSchema } from "@/types/profile";
import { jsonError } from "@/lib/utils/validation";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // #region agent log
  console.error('[debug-7bdc60] GET /api/profile auth:', JSON.stringify({hasUser:!!user,userId:user?.id??null,emailConfirmed:user?.email_confirmed_at??null}));
  fetch('http://127.0.0.1:7918/ingest/c3a3bfcf-a94d-45d2-a9fc-846a986bdef8',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'7bdc60'},body:JSON.stringify({sessionId:'7bdc60',location:'api/profile/route.ts:GET:auth',message:'getUser result',data:{hasUser:!!user,userId:user?.id??null,email:user?.email??null,emailConfirmed:user?.email_confirmed_at??null,role:user?.role??null},timestamp:Date.now(),hypothesisId:'H1'})}).catch(()=>{});
  // #endregion

  if (!user) return jsonError("Unauthorized", 401);

  const [profileResult, prefsResult] = await Promise.all([
    supabase.from("profiles").select("*").eq("user_id", user.id).single(),
    supabase
      .from("user_preferences")
      .select("*")
      .eq("user_id", user.id)
      .single(),
  ]);

  // #region agent log
  fetch('http://127.0.0.1:7918/ingest/c3a3bfcf-a94d-45d2-a9fc-846a986bdef8',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'7bdc60'},body:JSON.stringify({sessionId:'7bdc60',location:'api/profile/route.ts:GET:data',message:'profile+prefs query results',data:{profileData:profileResult.data,profileError:profileResult.error?.message??null,prefsData:prefsResult.data,prefsError:prefsResult.error?.message??null},timestamp:Date.now(),hypothesisId:'H5'})}).catch(()=>{});
  // #endregion

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
  console.error('[debug-7bdc60] PUT /api/profile auth:', JSON.stringify({hasUser:!!user,userId:user?.id??null,emailConfirmed:user?.email_confirmed_at??null}));
  fetch('http://127.0.0.1:7918/ingest/c3a3bfcf-a94d-45d2-a9fc-846a986bdef8',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'7bdc60'},body:JSON.stringify({sessionId:'7bdc60',location:'api/profile/route.ts:PUT:auth',message:'PUT getUser result',data:{hasUser:!!user,userId:user?.id??null,email:user?.email??null,emailConfirmed:user?.email_confirmed_at??null},timestamp:Date.now(),hypothesisId:'H1'})}).catch(()=>{});
  // #endregion

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

  // #region agent log
  console.error('[debug-7bdc60] PUT /api/profile upsert:', JSON.stringify({hasData:!!data,error:error?.message??null,code:error?.code??null}));
  fetch('http://127.0.0.1:7918/ingest/c3a3bfcf-a94d-45d2-a9fc-846a986bdef8',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'7bdc60'},body:JSON.stringify({sessionId:'7bdc60',location:'api/profile/route.ts:PUT:upsert',message:'upsert result',data:{hasData:!!data,error:error?.message??null,errorCode:error?.code??null},timestamp:Date.now(),hypothesisId:'H5'})}).catch(()=>{});
  // #endregion

  if (error) return jsonError(error.message, 500);

  return NextResponse.json(data);
}
