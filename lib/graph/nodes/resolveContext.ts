import type { RecommendationState } from "../state";
import { resolveActiveSlot } from "@/lib/budgets/slotResolver";
import { getPersonalizationHints } from "@/lib/personalization/personalizationEngine";
import { createClient } from "@/lib/supabase/server";

export async function resolveContext(
  state: RecommendationState
): Promise<Partial<RecommendationState>> {
  // #region agent log
  fetch('http://127.0.0.1:7918/ingest/c3a3bfcf-a94d-45d2-a9fc-846a986bdef8',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'e1907f'},body:JSON.stringify({sessionId:'e1907f',location:'resolveContext.ts:entry',message:'resolveContext entered',data:{userId:state.userId,budgetChoice:state.budgetChoice},timestamp:Date.now(),hypothesisId:'A'})}).catch(()=>{});
  // #endregion

  const supabase = await createClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let resolved: any[];
  try {
    resolved = await Promise.all([
      resolveActiveSlot(state.userId),
      supabase
        .from("user_preferences")
        .select("*")
        .eq("user_id", state.userId)
        .single(),
      getPersonalizationHints(state.userId),
    ]);
  } catch (promiseErr) {
    // #region agent log
    fetch('http://127.0.0.1:7918/ingest/c3a3bfcf-a94d-45d2-a9fc-846a986bdef8',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'e1907f'},body:JSON.stringify({sessionId:'e1907f',location:'resolveContext.ts:promiseAll-catch',message:'Promise.all threw',data:{error:String(promiseErr),stack:(promiseErr as Error)?.stack},timestamp:Date.now(),hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    throw promiseErr;
  }

  const [slot, prefsResult, personalization] = resolved;

  // #region agent log
  fetch('http://127.0.0.1:7918/ingest/c3a3bfcf-a94d-45d2-a9fc-846a986bdef8',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'e1907f'},body:JSON.stringify({sessionId:'e1907f',location:'resolveContext.ts:after-resolve',message:'resolveContext resolved',data:{slotFound:!!slot,budgetChoice:state.budgetChoice,hasPrefs:!!prefsResult.data,hasPersonalization:!!personalization},timestamp:Date.now(),hypothesisId:'A'})}).catch(()=>{});
  // #endregion

  const preferences = prefsResult.data;
  const radiusKm = preferences?.travel_radius_km ?? 5;

  if (!slot && state.budgetChoice === "slot") {
    // #region agent log
    fetch('http://127.0.0.1:7918/ingest/c3a3bfcf-a94d-45d2-a9fc-846a986bdef8',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'e1907f'},body:JSON.stringify({sessionId:'e1907f',location:'resolveContext.ts:no-slot-early-exit',message:'No active slot, setting earlyExitReason',data:{earlyExitReason:'NO_ACTIVE_BUDGET_SLOT'},timestamp:Date.now(),hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    return {
      slot: null,
      preferences,
      personalization,
      radiusKm,
      earlyExitReason: "NO_ACTIVE_BUDGET_SLOT",
    };
  }

  return { slot: slot ?? null, preferences, personalization, radiusKm };
}
