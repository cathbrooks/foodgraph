import type { RecommendationState } from "../state";
import { resolveActiveSlot } from "@/lib/budgets/slotResolver";
import { getPersonalizationHints } from "@/lib/personalization/personalizationEngine";
import { createClient } from "@/lib/supabase/server";

export async function resolveContext(
  state: RecommendationState
): Promise<Partial<RecommendationState>> {
  const supabase = await createClient();

  const [slot, prefsResult, personalization] = await Promise.all([
    resolveActiveSlot(state.userId),
    supabase
      .from("user_preferences")
      .select("*")
      .eq("user_id", state.userId)
      .single(),
    getPersonalizationHints(state.userId),
  ]);

  const preferences = prefsResult.data;
  const radiusKm = preferences?.travel_radius_km ?? 5;

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
