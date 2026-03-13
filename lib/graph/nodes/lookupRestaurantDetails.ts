import type { RecommendationState } from "../state";
import type { RestaurantDetails, RecommendationContext } from "@/types/chat";
import { getPlaceDetails } from "@/lib/restaurants/restaurantProvider";
import { fetchRestaurantInsights } from "@/lib/ai/searchPreview";

function findTargetRestaurant(
  state: RecommendationState
): RecommendationContext | null {
  const target = state.intent?.constraints.targetRestaurant?.toLowerCase();
  const restaurants = state.sessionState?.restaurants ?? [];

  if (target) {
    const match = restaurants.find(
      (r) => r.restaurant_name.toLowerCase() === target
    );
    if (match) return match;

    const partial = restaurants.find((r) =>
      r.restaurant_name.toLowerCase().includes(target)
    );
    if (partial) return partial;
  }

  if (state.sessionState?.selectedRestaurant) {
    return state.sessionState.selectedRestaurant;
  }

  if (restaurants.length === 1) {
    return restaurants[0];
  }

  return null;
}

export async function lookupRestaurantDetails(
  state: RecommendationState
): Promise<Partial<RecommendationState>> {
  const target = findTargetRestaurant(state);

  if (!target) {
    return { lookedUpDetails: null };
  }

  const existing = state.sessionState?.restaurantDetails?.[target.place_id];
  if (existing) {
    return { lookedUpDetails: existing };
  }

  try {
    const [placeDetails, insights] = await Promise.all([
      getPlaceDetails(target.place_id),
      fetchRestaurantInsights(
        target.restaurant_name,
        ""
      ).catch(() => null),
    ]);

    const details: RestaurantDetails = {
      place_id: target.place_id,
      name: target.restaurant_name,
      summary: insights?.summary ?? null,
      knownFor: insights?.knownFor ?? [],
      atmosphere: insights?.atmosphere ?? null,
      hours: insights?.hours ?? null,
      specials: insights?.specials ?? null,
      reviews: insights?.reviews ?? null,
      website_url: placeDetails.website_url,
      menu_url: placeDetails.menu_url,
    };

    return { lookedUpDetails: details };
  } catch (err) {
    console.error("[lookupRestaurantDetails] failed:", err);
    return { lookedUpDetails: null };
  }
}
