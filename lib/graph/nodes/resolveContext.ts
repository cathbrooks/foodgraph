import type { RecommendationState } from "../state";
import { resolveActiveSlot } from "@/lib/budgets/slotResolver";
import { getPersonalizationHints } from "@/lib/personalization/personalizationEngine";
import { createClient } from "@/lib/supabase/server";

export async function resolveContext(
  state: RecommendationState
): Promise<Partial<RecommendationState>> {
  const supabase = await createClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let resolved: any[];
  try {
    resolved = await Promise.all([
      resolveActiveSlot(state.userId, undefined, state.timezone),
      supabase
        .from("user_preferences")
        .select("*")
        .eq("user_id", state.userId)
        .single(),
      getPersonalizationHints(state.userId),
    ]);
  } catch (promiseErr) {
    throw promiseErr;
  }

  const [slot, prefsResult, personalization] = resolved;

  const preferences = prefsResult.data;
  const radiusKm = preferences?.travel_radius_km ?? 5;

  // #region agent log
  fetch('http://127.0.0.1:7918/ingest/c3a3bfcf-a94d-45d2-a9fc-846a986bdef8',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'7190a2'},body:JSON.stringify({sessionId:'7190a2',location:'resolveContext.ts:slotResult',message:'Slot resolution result',data:{slotFound:!!slot,slotLabel:slot?.label??null,budgetChoice:state.budgetChoice,willEarlyExit:!slot&&state.budgetChoice==='slot'},timestamp:Date.now(),hypothesisId:'ALL'})}).catch(()=>{});
  // #endregion

  if (!slot && state.budgetChoice === "slot") {
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
