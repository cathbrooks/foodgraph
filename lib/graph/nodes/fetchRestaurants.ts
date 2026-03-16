import type { RecommendationState } from "../state";
import { getRestaurantsWithCache } from "@/lib/restaurants/restaurantCache";

function buildSearchQuery(state: RecommendationState): string | undefined {
  const parts: string[] = [];
  const constraints = state.intent?.constraints;
  if (constraints?.searchQuery) parts.push(constraints.searchQuery);
  if (constraints?.cuisineFilter) parts.push(constraints.cuisineFilter);
  if (constraints?.dietaryFilter) parts.push(constraints.dietaryFilter);
  return parts.length > 0 ? parts.join(" ") : undefined;
}

export async function fetchRestaurants(
  state: RecommendationState
): Promise<Partial<RecommendationState>> {
  const query = buildSearchQuery(state);
  const searchSource = query ? "text" as const : "nearby" as const;

  const candidates = await getRestaurantsWithCache({
    location: state.location,
    radiusKm: state.radiusKm,
    query,
  });

  if (candidates.length === 0) {
    return { candidates, searchSource, earlyExitReason: "NO_NEARBY_RESTAURANTS" };
  }

  return { candidates, searchSource };
}
