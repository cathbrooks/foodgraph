import type { Restaurant } from "@/types/restaurant";
import type { UserPreferences } from "@/types/profile";
import type { ScoredRecommendation } from "@/types/recommendation";

export function selectWildcard(
  candidates: Restaurant[],
  alreadyRecommended: Restaurant[],
  preferences: UserPreferences | null
): ScoredRecommendation | null {
  const recommendedIds = new Set(alreadyRecommended.map((r) => r.place_id));
  const remaining = candidates.filter((r) => !recommendedIds.has(r.place_id));

  if (remaining.length === 0) return null;

  const userCuisines = new Set(preferences?.cuisines ?? []);

  const scored = remaining.map((r) => {
    let score = 0;

    // Prefer restaurants outside the user's normal cuisine preferences
    const isOutsidePrefs =
      userCuisines.size > 0 &&
      r.cuisines.length > 0 &&
      !r.cuisines.some((c) =>
        [...userCuisines].some(
          (p) => c.toLowerCase().includes(p) || p.includes(c.toLowerCase())
        )
      );
    if (isOutsidePrefs) score += 3;

    // Strongly prefer highly rated restaurants
    if (r.rating != null) {
      if (r.rating >= 4.5) score += 4;
      else if (r.rating >= 4.0) score += 3;
      else if (r.rating >= 3.5) score += 1;
    }

    // Prefer reasonable distance (not too far)
    if (r.distance_km != null) {
      if (r.distance_km <= 2) score += 2;
      else if (r.distance_km <= 5) score += 1;
    }

    // Prefer places with price data within a tolerable range
    if (r.avg_price_per_person != null && r.avg_price_per_person <= 50) {
      score += 1;
    }

    // Review count as tiebreaker for quality signal
    if (r.review_count != null && r.review_count >= 50) {
      score += 1;
    }

    return { restaurant: r, score };
  });

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return (b.restaurant.rating ?? 0) - (a.restaurant.rating ?? 0);
  });

  const topScore = scored[0].score;
  const topTier = scored.filter((s) => s.score >= topScore - 1);

  const weights = topTier.map((s) => s.score + 1);
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  let roll = Math.random() * totalWeight;
  let chosen = 0;
  for (let i = 0; i < weights.length; i++) {
    roll -= weights[i];
    if (roll <= 0) {
      chosen = i;
      break;
    }
  }

  const pick = topTier[chosen].restaurant;

  return {
    restaurant: pick,
    score: {
      budget_fit: 0,
      cuisine_match: 0,
      distance: 0,
      rating: pick.rating ? pick.rating / 5 : 0,
      personalization: 0,
      total: 0,
    },
    explanation: null,
    is_wildcard: true,
  };
}
