import type Anthropic from "@anthropic-ai/sdk";
import type { AgentTool } from "@/lib/agent/runner";
import { getGooglePlaceDetails } from "@/lib/restaurants/googlePlacesProvider";
import type { PlaceDetails } from "@/types/restaurant";

const EMPTY_DETAILS: PlaceDetails = {
  website_url: null,
  google_maps_url: null,
  google_place_id: null,
  location: null,
  editorial_summary: null,
  reviews: [],
  opening_hours: null,
  is_open_now: null,
  price_level: null,
  dine_in: null,
  delivery: null,
  takeout: null,
  reservable: null,
  serves_vegetarian: null,
  photos: [],
  known_for: [],
};

const definition: Anthropic.Tool = {
  name: "get_restaurant_details",
  description:
    "Fetch detailed information about a specific restaurant including hours, reviews, website, and delivery options. Call this when the user asks about a specific restaurant.",
  input_schema: {
    type: "object" as const,
    properties: {
      place_id: {
        type: "string",
        description: "The Google Place ID of the restaurant",
      },
      name: {
        type: "string",
        description: "The restaurant name",
      },
      address: {
        type: "string",
        description: "The restaurant address",
      },
    },
    required: ["place_id", "name", "address"],
  },
};

export function buildGetRestaurantDetailsTool(): AgentTool {
  return {
    definition,
    handler: async (input) => {
      const place_id = input.place_id as string;
      const name = input.name as string;
      const address = input.address as string;

      try {
        return await getGooglePlaceDetails(place_id, name, address);
      } catch (err) {
        console.error("[getRestaurantDetails] Failed to fetch details:", err);
        return EMPTY_DETAILS;
      }
    },
  };
}
