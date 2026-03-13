import type { RecommendationState } from "../state";
import type { BudgetSlot } from "@/types/budget";
import { filterRestaurants } from "@/lib/restaurants/filters";
import { scoreRestaurants } from "@/lib/scoring/recommendationScorer";

function resolveEffectiveBudget(state: RecommendationState): BudgetSlot | null {
  const constraints = state.intent?.constraints ?? {};

  if (state.budgetChoice === "none") return null;

  if (state.budgetChoice === "custom" && state.customBudgetCeiling != null) {
    const ceiling = constraints.priceCeiling != null
      ? Math.min(state.customBudgetCeiling, constraints.priceCeiling)
      : state.customBudgetCeiling;

    return {
      id: "custom",
      user_id: state.userId,
      label: "Custom",
      days: [],
      start_time: "00:00",
      end_time: "23:59",
      min_budget: 0,
      max_budget: ceiling,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as BudgetSlot;
  }

  if (state.slot && constraints.priceCeiling != null) {
    return {
      ...state.slot,
      max_budget: Math.min(state.slot.max_budget, constraints.priceCeiling),
    };
  }

  return state.slot;
}

export async function filterAndScore(
  state: RecommendationState
): Promise<Partial<RecommendationState>> {
  const constraints = state.intent?.constraints ?? {};
  const effectiveBudget = resolveEffectiveBudget(state);

  console.log("[filterAndScore] constraints:", JSON.stringify(constraints));
  console.log("[filterAndScore] effectiveBudget:", effectiveBudget ? `$${effectiveBudget.min_budget}–$${effectiveBudget.max_budget}` : "none");
  console.log("[filterAndScore] candidates:", state.candidates.length);

  const filtered = filterRestaurants(state.candidates, {
    budget: effectiveBudget,
    preferences: state.preferences,
    maxDistanceKm: state.radiusKm,
    requireOpenNow: true,
    cuisineOverride: constraints.cuisineFilter,
    dietaryOverride: constraints.dietaryFilter,
    priceFloor: constraints.priceFloor,
  });

  console.log("[filterAndScore] filtered:", filtered.length);

  if (filtered.length === 0) {
    return { filtered, scored: [], earlyExitReason: "NO_MATCHING_RESTAURANTS" };
  }

  const scored = scoreRestaurants(filtered, {
    budget: effectiveBudget,
    preferences: state.preferences,
    userLocationLat: state.location.lat,
    userLocationLng: state.location.lng,
    personalization: state.personalization,
    priceFloor: constraints.priceFloor,
  }, 10);

  return { filtered, scored };
}
