import type { RecommendationState } from "../state";
import type { RestaurantDetails, RecommendationContext } from "@/types/chat";
import { getPlaceDetails } from "@/lib/restaurants/restaurantProvider";

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
    const placeDetails = await getPlaceDetails(target.place_id, target.restaurant_name, "");

    const details: RestaurantDetails = {
      place_id: target.place_id,
      name: target.restaurant_name,
      website_url: placeDetails.website_url,
      google_maps_url: placeDetails.google_maps_url,
      google_place_id: placeDetails.google_place_id,
      location: placeDetails.location,
      editorial_summary: placeDetails.editorial_summary,
      reviews: placeDetails.reviews,
      opening_hours: placeDetails.opening_hours,
      is_open_now: placeDetails.is_open_now,
      dine_in: placeDetails.dine_in,
      delivery: placeDetails.delivery,
      takeout: placeDetails.takeout,
      reservable: placeDetails.reservable,
      serves_vegetarian: placeDetails.serves_vegetarian,
      photos: placeDetails.photos,
      known_for: placeDetails.known_for,
    };

    return { lookedUpDetails: details };
  } catch (err) {
    console.error("[lookupRestaurantDetails] failed:", err);
    return { lookedUpDetails: null };
  }
}
