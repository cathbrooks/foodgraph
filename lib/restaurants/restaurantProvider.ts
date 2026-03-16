import type { Restaurant, Location, PriceLevel } from "@/types/restaurant";
import { distanceKm } from "@/lib/utils/geo";

export interface RestaurantSearchParams {
  location: Location;
  radiusKm: number;
  query?: string;
  maxResults?: number;
}

const GOOGLE_BASE = "https://places.googleapis.com/v1";

const GOOGLE_PRICE_MAP: Record<string, PriceLevel> = {
  PRICE_LEVEL_INEXPENSIVE: "$",
  PRICE_LEVEL_MODERATE: "$$",
  PRICE_LEVEL_EXPENSIVE: "$$$",
  PRICE_LEVEL_VERY_EXPENSIVE: "$$$$",
};

const AVG_PRICE_MAP: Record<string, number> = {
  $: 10,
  $$: 20,
  $$$: 40,
  $$$$: 70,
};

const GENERIC_TYPES = new Set([
  "food",
  "restaurant",
  "establishment",
  "point_of_interest",
  "food_and_drink",
]);

const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.location",
  "places.types",
  "places.priceLevel",
  "places.rating",
  "places.userRatingCount",
  "places.regularOpeningHours",
  "places.photos",
  "places.websiteUri",
  "places.primaryType",
  "places.primaryTypeDisplayName",
].join(",");

const DIETARY_KEYWORDS: Record<string, string[]> = {
  vegetarian: ["vegetarian", "veggie", "vegan_restaurant", "vegetarian_restaurant"],
  vegan: ["vegan", "vegan_restaurant"],
  "gluten-free": ["gluten-free", "gluten free", "celiac"],
  halal: ["halal"],
  kosher: ["kosher"],
  "dairy-free": ["dairy-free", "dairy free", "lactose-free"],
};

function getApiKey(): string {
  const key = process.env.GOOGLE_PLACES_API_KEY ?? "";
  if (!key) console.warn("GOOGLE_PLACES_API_KEY is not configured");
  return key;
}

export async function searchNearbyRestaurants(
  params: RestaurantSearchParams
): Promise<Restaurant[]> {
  const apiKey = getApiKey();
  if (!apiKey) return [];

  const { location, radiusKm } = params;
  const radiusMeters = Math.min(Math.round(radiusKm * 1000), 50000);

  const body = {
    includedTypes: ["restaurant"],
    maxResultCount: 20,
    rankPreference: "DISTANCE",
    locationRestriction: {
      circle: {
        center: { latitude: location.lat, longitude: location.lng },
        radius: radiusMeters,
      },
    },
  };

  let res: Response;
  try {
    res = await fetch(`${GOOGLE_BASE}/places:searchNearby`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": FIELD_MASK,
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    console.error("Google Places API network error:", err);
    return [];
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error(`Google Places API error ${res.status}: ${text}`);
    return [];
  }

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    console.error("Google Places API returned invalid JSON");
    return [];
  }

  const places = (data as Record<string, unknown>)?.places;
  const results: unknown[] = Array.isArray(places) ? places : [];

  return results.map((place) => mapGooglePlace(place, location, apiKey));
}

const TEXT_SEARCH_FIELD_MASK = [FIELD_MASK, "nextPageToken"].join(",");

const MIN_DESIRED_RESULTS = 10;
const MAX_PAGES = 3;

export async function searchTextRestaurants(
  params: RestaurantSearchParams
): Promise<Restaurant[]> {
  const apiKey = getApiKey();
  if (!apiKey) return [];

  const { location, radiusKm, query } = params;
  if (!query) return searchNearbyRestaurants(params);

  const radiusMeters = Math.min(Math.round(radiusKm * 1000), 50000);

  const body: Record<string, unknown> = {
    textQuery: `${query} restaurant`,
    includedType: "restaurant",
    strictTypeFiltering: true,
    openNow: true,
    locationBias: {
      circle: {
        center: { latitude: location.lat, longitude: location.lng },
        radius: radiusMeters,
      },
    },
    pageSize: 20,
  };

  const all: Restaurant[] = [];
  let pageToken: string | undefined;

  for (let page = 0; page < MAX_PAGES; page++) {
    if (page > 0 && !pageToken) break;
    if (page > 0) body.pageToken = pageToken;

    let res: Response;
    try {
      res = await fetch(`${GOOGLE_BASE}/places:searchText`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": TEXT_SEARCH_FIELD_MASK,
        },
        body: JSON.stringify(body),
      });
    } catch (err) {
      console.error("Google Text Search API network error:", err);
      break;
    }

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error(`Google Text Search API error ${res.status}: ${text}`);
      break;
    }

    let data: Record<string, unknown>;
    try {
      data = (await res.json()) as Record<string, unknown>;
    } catch {
      console.error("Google Text Search API returned invalid JSON");
      break;
    }

    const places = Array.isArray(data.places) ? data.places : [];
    all.push(...(places as unknown[]).map((p) => mapGooglePlace(p, location, apiKey)));

    pageToken = typeof data.nextPageToken === "string" ? data.nextPageToken : undefined;

    if (all.length >= MIN_DESIRED_RESULTS || !pageToken) break;
  }

  console.log(`[textSearch] query="${query}" fetched ${all.length} candidates across up to ${MAX_PAGES} pages`);
  return all;
}

interface GooglePlace {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  types?: string[];
  priceLevel?: string;
  rating?: number;
  userRatingCount?: number;
  regularOpeningHours?: { openNow?: boolean };
  photos?: Array<{ name?: string }>;
  websiteUri?: string;
  primaryType?: string;
  primaryTypeDisplayName?: { text?: string };
}

function mapGooglePlace(
  raw: unknown,
  userLocation: Location,
  apiKey: string
): Restaurant {
  const place = raw as GooglePlace;

  const placeId = place.id ?? "";
  const name = place.displayName?.text ?? "Unknown";
  const address = place.formattedAddress ?? "";

  const restaurantLocation: Location = {
    lat: place.location?.latitude ?? 0,
    lng: place.location?.longitude ?? 0,
  };

  const priceLevel: PriceLevel | null =
    place.priceLevel ? (GOOGLE_PRICE_MAP[place.priceLevel] ?? null) : null;
  const avgPrice = priceLevel ? (AVG_PRICE_MAP[priceLevel] ?? null) : null;

  const rating =
    typeof place.rating === "number"
      ? Math.round(place.rating * 10) / 10
      : null;

  const reviewCount =
    typeof place.userRatingCount === "number" ? place.userRatingCount : null;

  const cuisines = extractCuisines(place.types, place.primaryTypeDisplayName?.text);

  const isOpenNow =
    typeof place.regularOpeningHours?.openNow === "boolean"
      ? place.regularOpeningHours.openNow
      : null;

  const dist =
    restaurantLocation.lat !== 0
      ? Math.round(distanceKm(userLocation, restaurantLocation) * 10) / 10
      : null;

  const firstPhoto = place.photos?.[0];
  const photoUrl = firstPhoto?.name
    ? `${GOOGLE_BASE}/${firstPhoto.name}/media?maxWidthPx=400&maxHeightPx=400&key=${apiKey}`
    : null;

  const websiteUrl =
    typeof place.websiteUri === "string" && place.websiteUri.length > 0
      ? place.websiteUri
      : null;

  return {
    id: placeId,
    place_id: placeId,
    name,
    address,
    location: restaurantLocation,
    price_level: priceLevel,
    avg_price_per_person: avgPrice,
    rating,
    review_count: reviewCount,
    cuisines,
    dietary_tags: extractDietaryTags(place.types, name),
    is_open_now: isOpenNow,
    distance_km: dist,
    photo_url: photoUrl,
    website_url: websiteUrl,
  };
}

function extractCuisines(
  types: string[] | undefined,
  primaryDisplayName: string | undefined
): string[] {
  const cuisines = new Set<string>();

  if (primaryDisplayName && primaryDisplayName.toLowerCase() !== "restaurant") {
    cuisines.add(primaryDisplayName);
  }

  if (Array.isArray(types)) {
    for (const t of types) {
      if (GENERIC_TYPES.has(t)) continue;
      const formatted = t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
      if (formatted.toLowerCase() !== "restaurant") {
        cuisines.add(formatted);
      }
    }
  }

  return Array.from(cuisines);
}

function extractDietaryTags(
  types: string[] | undefined,
  restaurantName: string
): string[] {
  const tags = new Set<string>();
  const searchText = [
    restaurantName,
    ...(types ?? []),
  ]
    .join(" ")
    .toLowerCase();

  for (const [tag, keywords] of Object.entries(DIETARY_KEYWORDS)) {
    if (keywords.some((kw) => searchText.includes(kw))) {
      tags.add(tag);
    }
  }

  return Array.from(tags);
}

export { getGooglePlaceDetails as getPlaceDetails } from "./googlePlacesProvider";
