import type { Restaurant } from "@/types/restaurant";
import type { BudgetSlot } from "@/types/budget";
import type { UserPreferences } from "@/types/profile";
import type { ScoredRecommendation, ScoreBreakdown } from "@/types/recommendation";
import type { PersonalizationHints } from "@/lib/personalization/personalizationEngine";

export interface ScoringContext {
  budget: BudgetSlot | null;
  preferences: UserPreferences | null;
  userLocationLat: number;
  userLocationLng: number;
  personalization?: PersonalizationHints | null;
  priceFloor?: number;
}

const WEIGHTS = {
  budget_fit: 0.3,
  cuisine_match: 0.25,
  distance: 0.2,
  rating: 0.15,
  personalization: 0.1,
};

export function scoreRestaurants(
  restaurants: Restaurant[],
  context: ScoringContext,
  limit: number = 5
): ScoredRecommendation[] {
  const scored = restaurants.map((restaurant) => {
    const score = computeScore(restaurant, context);
    return { restaurant, score, explanation: null as string | null, is_wildcard: false };
  });

  scored.sort((a, b) => b.score.total - a.score.total);

  return scored.slice(0, limit);
}

function computeScore(r: Restaurant, ctx: ScoringContext): ScoreBreakdown {
  const budget_fit = scoreBudgetFit(r, ctx.budget, ctx.priceFloor);
  const cuisine_match = scoreCuisineMatch(r, ctx.preferences, ctx.personalization);
  const distance = scoreDistance(r);
  const rating = scoreRating(r);
  const personalization = scorePersonalization(r, ctx.personalization);

  const total =
    budget_fit * WEIGHTS.budget_fit +
    cuisine_match * WEIGHTS.cuisine_match +
    distance * WEIGHTS.distance +
    rating * WEIGHTS.rating +
    personalization * WEIGHTS.personalization;

  return {
    budget_fit: round(budget_fit),
    cuisine_match: round(cuisine_match),
    distance: round(distance),
    rating: round(rating),
    personalization: round(personalization),
    total: round(total),
  };
}

function scoreBudgetFit(r: Restaurant, budget: BudgetSlot | null, priceFloor?: number): number {
  if (priceFloor != null) {
    if (r.avg_price_per_person != null) {
      if (r.avg_price_per_person >= priceFloor) return Math.min(1, 0.7 + (r.avg_price_per_person - priceFloor) / 100);
      return 0.2;
    }
    const priceLevelValues: Record<string, number> = { "$": 0.1, "$$": 0.3, "$$$": 0.7, "$$$$": 1.0 };
    if (r.price_level != null) return priceLevelValues[r.price_level] ?? 0.5;
    return 0.6;
  }

  if (!budget || r.avg_price_per_person == null) return 0.5;

  const midBudget = (budget.min_budget + budget.max_budget) / 2;
  const range = budget.max_budget - budget.min_budget || 1;
  const deviation = Math.abs(r.avg_price_per_person - midBudget) / range;

  return Math.max(0, 1 - deviation);
}

function scoreCuisineMatch(
  r: Restaurant,
  prefs: UserPreferences | null,
  hints?: PersonalizationHints | null
): number {
  if (r.cuisines.length === 0) return 0.3;

  let score = 0.3;

  if (prefs?.cuisines && prefs.cuisines.length > 0) {
    const match = r.cuisines.some((c) =>
      prefs.cuisines.some(
        (p) => c.toLowerCase().includes(p) || p.includes(c.toLowerCase())
      )
    );
    if (match) score = 0.8;
  }

  if (hints?.preferred_cuisines && hints.preferred_cuisines.length > 0) {
    const histMatch = r.cuisines.some((c) =>
      hints.preferred_cuisines.some((h) => c.toLowerCase().includes(h))
    );
    if (histMatch) score = Math.min(1, score + 0.2);
  }

  return score;
}

function scoreDistance(r: Restaurant): number {
  if (r.distance_km == null) return 0.5;
  if (r.distance_km <= 0.5) return 1;
  if (r.distance_km <= 1) return 0.9;
  if (r.distance_km <= 3) return 0.7;
  if (r.distance_km <= 5) return 0.5;
  if (r.distance_km <= 10) return 0.3;
  return 0.1;
}

function scoreRating(r: Restaurant): number {
  if (r.rating == null) return 0.5;
  return r.rating / 5;
}

function scorePersonalization(
  r: Restaurant,
  hints?: PersonalizationHints | null
): number {
  if (!hints) return 0.5;

  let score = 0.5;

  if (hints.avg_selected_price != null && r.avg_price_per_person != null) {
    const diff = Math.abs(r.avg_price_per_person - hints.avg_selected_price);
    if (diff <= 5) score += 0.2;
    else if (diff <= 10) score += 0.1;
  }

  if (hints.preferred_cuisines.length > 0) {
    const match = r.cuisines.some((c) =>
      hints.preferred_cuisines.some((h) => c.toLowerCase().includes(h))
    );
    if (match) score += 0.2;
  }

  return Math.min(1, score);
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
