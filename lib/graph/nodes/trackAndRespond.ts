import type { RecommendationState } from "../state";
import type { ChatMessage, ChatResponse, RecommendationContext, StateUpdates } from "@/types/chat";
import { trackRecommendationEvent } from "@/lib/chat/trackRecommendation";

function toRecommendationContext(
  results: RecommendationState["scored"]
): RecommendationContext[] {
  return results.map((r) => ({
    restaurant_name: r.restaurant.name,
    place_id: r.restaurant.place_id,
    cuisine: r.restaurant.cuisines?.[0] ?? null,
    avg_price: r.restaurant.avg_price_per_person ?? null,
    rating: r.restaurant.rating ?? null,
    distance_km: r.restaurant.distance_km ?? null,
    is_wildcard: r.is_wildcard ?? false,
    explanation: r.explanation ?? null,
  }));
}

export async function trackAndRespond(
  state: RecommendationState
): Promise<Partial<RecommendationState>> {
  const allResults = state.wildcard
    ? [state.wildcard]
    : state.scored;

  let budgetLabel = "";
  if (state.budgetChoice === "slot" && state.slot) {
    budgetLabel = ` Your active budget slot is "${state.slot.label}" ($${state.slot.min_budget}–$${state.slot.max_budget}).`;
  } else if (state.budgetChoice === "custom" && state.customBudgetCeiling) {
    budgetLabel = ` Filtered to under $${state.customBudgetCeiling} per person.`;
  }

  const content = state.wildcard
    ? `Here's a wildcard pick for you!${budgetLabel}`
    : `Here are ${allResults.length} picks for you!${budgetLabel}`;

  let eventId: string | null = null;
  try {
    eventId = await trackRecommendationEvent({
      userId: state.userId,
      slot: state.slot,
      location: state.location,
      results: allResults,
      candidateCount: state.candidates.length,
      filtersApplied: {
        budget: !!state.slot,
        open_now: true,
        max_distance_km: state.radiusKm,
        dietary: state.preferences?.dietary_restrictions ?? [],
        cuisine_override: state.intent?.constraints.cuisineFilter ?? null,
      },
    });
  } catch (err) {
    console.error("Failed to track recommendation event:", err);
  }

  const message: ChatMessage = {
    id: crypto.randomUUID(),
    role: "assistant",
    content,
    recommendations: allResults.length > 0 ? allResults : null,
    created_at: new Date().toISOString(),
  };

  const stateUpdates: StateUpdates = {
    restaurants: toRecommendationContext(allResults),
  };

  const response: ChatResponse = {
    message,
    recommendation_event_id: eventId,
    state_updates: stateUpdates,
  };

  return { response };
}
