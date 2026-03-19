import type Anthropic from "@anthropic-ai/sdk";
import type { AgentTool } from "@/lib/agent/runner";
import { getRestaurantsWithCache } from "@/lib/restaurants/restaurantCache";
import { filterRestaurants } from "@/lib/restaurants/filters";
import { scoreRestaurants } from "@/lib/scoring/recommendationScorer";
import { selectWildcard } from "@/lib/wildcard/wildcardEngine";
import type { BudgetSlot } from "@/types/budget";
import type { Location } from "@/types/restaurant";
import type { UserPreferences } from "@/types/profile";
import type { ScoredRecommendation } from "@/types/recommendation";
import type { PersonalizationHints } from "@/lib/personalization/personalizationEngine";

export interface ToolContext {
  userId: string;
  location: Location;
  radiusKm: number;
  activeSlot: BudgetSlot | null;
  preferences: UserPreferences | null;
  personalization: PersonalizationHints | null;
  budgetChoice: "slot" | "custom" | "none" | null;
  customBudgetCeiling: number | null;
}

const definition: Anthropic.Tool = {
  name: "search_restaurants",
  description:
    "Search for nearby restaurants matching the user's request. Call this when the user wants restaurant recommendations.",
  input_schema: {
    type: "object" as const,
    properties: {
      cuisine: {
        type: "string",
        description:
          "Cuisine type to filter by, e.g. 'thai', 'italian', 'mexican'",
      },
      dietary: {
        type: "string",
        description:
          "Dietary restriction to filter by, e.g. 'vegetarian', 'gluten-free', 'halal'",
      },
      search_query: {
        type: "string",
        description:
          "Free-text search query, e.g. 'coffee shops', 'brunch spots', 'sushi'",
      },
      budget_ceiling: {
        type: "number",
        description:
          "Maximum price per person in dollars (overrides active budget slot)",
      },
      budget_floor: {
        type: "number",
        description:
          "Minimum price per person in dollars (for upscale or nicer restaurant requests)",
      },
      wildcard: {
        type: "boolean",
        description:
          "Set to true to use the wildcard engine and return one surprise pick outside the user's usual preferences",
      },
    },
    required: [],
  },
};

function buildSyntheticSlot(
  userId: string,
  min: number,
  max: number
): BudgetSlot {
  return {
    id: "synthetic",
    user_id: userId,
    label: "Custom",
    days: [],
    start_time: "00:00",
    end_time: "23:59",
    min_budget: min,
    max_budget: max,
    hidden: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

export function buildSearchRestaurantsTool(
  context: ToolContext,
  onResults?: (results: ScoredRecommendation[]) => void
): AgentTool {
  return {
    definition,
    handler: async (input) => {
      const cuisine = input.cuisine as string | undefined;
      const dietary = input.dietary as string | undefined;
      const search_query = input.search_query as string | undefined;
      const budget_ceiling = input.budget_ceiling as number | undefined;
      const budget_floor = input.budget_floor as number | undefined;
      const wildcard = input.wildcard as boolean | undefined;

      const restaurants = await getRestaurantsWithCache({
        location: context.location,
        radiusKm: context.radiusKm,
        query: search_query,
      });

      // Resolve effective budget
      let effectiveBudget: BudgetSlot | null = null;
      if (budget_ceiling != null || budget_floor != null) {
        effectiveBudget = buildSyntheticSlot(
          context.userId,
          budget_floor ?? 0,
          budget_ceiling ?? 999
        );
      } else if (context.budgetChoice === "slot") {
        effectiveBudget = context.activeSlot;
      } else if (
        context.budgetChoice === "custom" &&
        context.customBudgetCeiling != null
      ) {
        effectiveBudget = buildSyntheticSlot(
          context.userId,
          0,
          context.customBudgetCeiling
        );
      }

      const searchSource = search_query ? "text" : "nearby";

      const filtered = filterRestaurants(restaurants, {
        budget: effectiveBudget,
        preferences: context.preferences,
        cuisineOverride: cuisine,
        dietaryOverride: dietary,
        maxDistanceKm: context.radiusKm,
        searchSource,
      });

      if (wildcard) {
        const pick = selectWildcard(filtered, [], context.preferences);
        if (!pick) {
          onResults?.([]);
          return [];
        }
        onResults?.([pick]);
        return [
          {
            name: pick.restaurant.name,
            place_id: pick.restaurant.place_id,
            address: pick.restaurant.address,
            cuisines: pick.restaurant.cuisines,
            avg_price: pick.restaurant.avg_price_per_person,
            price_level: pick.restaurant.price_level,
            rating: pick.restaurant.rating,
            distance_km: pick.restaurant.distance_km,
            score: pick.score,
            is_wildcard: true,
            photo_url: pick.restaurant.photo_url,
          },
        ];
      }

      const scored = scoreRestaurants(
        filtered,
        {
          budget: effectiveBudget,
          preferences: context.preferences,
          userLocationLat: context.location.lat,
          userLocationLng: context.location.lng,
          personalization: context.personalization,
        },
        5
      );

      onResults?.(scored);

      return scored.map((r) => ({
        name: r.restaurant.name,
        place_id: r.restaurant.place_id,
        address: r.restaurant.address,
        cuisines: r.restaurant.cuisines,
        avg_price: r.restaurant.avg_price_per_person,
        price_level: r.restaurant.price_level,
        rating: r.restaurant.rating,
        distance_km: r.restaurant.distance_km,
        score: r.score,
        is_wildcard: false,
        photo_url: r.restaurant.photo_url,
      }));
    },
  };
}
