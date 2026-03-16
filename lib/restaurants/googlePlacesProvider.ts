import type { PlaceDetails, GoogleReview, Location } from "@/types/restaurant";
import { getGoogleDetailsCached, putGoogleDetailsCache } from "./googlePlacesCache";
import { fetchRestaurantInsights } from "@/lib/ai/searchPreview";

const GOOGLE_BASE = "https://places.googleapis.com/v1";

const DETAILS_FIELD_MASK = [
  "displayName",
  "formattedAddress",
  "rating",
  "userRatingCount",
  "reviews",
  "regularOpeningHours",
  "editorialSummary",
  "websiteUri",
  "googleMapsUri",
  "location",
  "priceLevel",
  "dineIn",
  "delivery",
  "takeout",
  "reservable",
  "servesVegetarianFood",
  "photos",
].join(",");

function getApiKey(): string {
  const key = process.env.GOOGLE_PLACES_API_KEY ?? "";
  if (!key) console.warn("GOOGLE_PLACES_API_KEY is not configured");
  return key;
}

interface GooglePlaceDetailsRaw {
  displayName?: { text?: string };
  formattedAddress?: string;
  rating?: number;
  userRatingCount?: number;
  reviews?: Array<{
    authorAttribution?: { displayName?: string };
    rating?: number;
    text?: { text?: string };
    relativePublishTimeDescription?: string;
  }>;
  regularOpeningHours?: {
    weekdayDescriptions?: string[];
    openNow?: boolean;
  };
  editorialSummary?: { text?: string };
  websiteUri?: string;
  googleMapsUri?: string;
  location?: { latitude?: number; longitude?: number };
  dineIn?: boolean;
  delivery?: boolean;
  takeout?: boolean;
  reservable?: boolean;
  priceLevel?: string;
  servesVegetarianFood?: boolean;
  photos?: Array<{ name?: string }>;
}

const GOOGLE_PRICE_LEVEL_MAP: Record<string, string> = {
  PRICE_LEVEL_FREE: "Free",
  PRICE_LEVEL_INEXPENSIVE: "$",
  PRICE_LEVEL_MODERATE: "$$",
  PRICE_LEVEL_EXPENSIVE: "$$$",
  PRICE_LEVEL_VERY_EXPENSIVE: "$$$$",
};

function mapGoogleReviews(
  raw: GooglePlaceDetailsRaw["reviews"]
): GoogleReview[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 5).map((r) => ({
    author: r.authorAttribution?.displayName ?? "Anonymous",
    rating: typeof r.rating === "number" ? r.rating : 5,
    text: r.text?.text ?? "",
    relative_time: r.relativePublishTimeDescription ?? "",
  }));
}

function buildPhotoUrls(
  photos: GooglePlaceDetailsRaw["photos"],
  apiKey: string
): string[] {
  if (!Array.isArray(photos)) return [];
  return photos.slice(0, 3).map(
    (p) =>
      `${GOOGLE_BASE}/${p.name}/media?maxWidthPx=400&maxHeightPx=400&key=${apiKey}`
  );
}

function mapLocation(
  raw: GooglePlaceDetailsRaw["location"]
): Location | null {
  if (!raw || typeof raw.latitude !== "number" || typeof raw.longitude !== "number") {
    return null;
  }
  return { lat: raw.latitude, lng: raw.longitude };
}

function mapToPlaceDetails(
  data: GooglePlaceDetailsRaw,
  googlePlaceId: string,
  apiKey: string,
  knownFor: string[] = []
): PlaceDetails {
  return {
    website_url: data.websiteUri ?? null,
    google_maps_url: data.googleMapsUri ?? null,
    google_place_id: googlePlaceId,
    location: mapLocation(data.location),
    editorial_summary: data.editorialSummary?.text ?? null,
    reviews: mapGoogleReviews(data.reviews),
    opening_hours: data.regularOpeningHours?.weekdayDescriptions ?? null,
    is_open_now: data.regularOpeningHours?.openNow ?? null,
    price_level: data.priceLevel ? (GOOGLE_PRICE_LEVEL_MAP[data.priceLevel] ?? null) : null,
    dine_in: data.dineIn ?? null,
    delivery: data.delivery ?? null,
    takeout: data.takeout ?? null,
    reservable: data.reservable ?? null,
    serves_vegetarian: data.servesVegetarianFood ?? null,
    photos: buildPhotoUrls(data.photos, apiKey),
    known_for: knownFor,
  };
}

async function fetchGooglePlaceDetails(
  googlePlaceId: string
): Promise<PlaceDetails | null> {
  const apiKey = getApiKey();
  if (!apiKey) return null;

  const res = await fetch(`${GOOGLE_BASE}/places/${googlePlaceId}`, {
    method: "GET",
    headers: {
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": DETAILS_FIELD_MASK,
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error(`Google Place Details error ${res.status}: ${text}`);
    return null;
  }

  const data = (await res.json()) as GooglePlaceDetailsRaw;
  return mapToPlaceDetails(data, googlePlaceId, apiKey);
}

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

/**
 * Fetches full Google Place Details for a given Google Place ID.
 * Checks Supabase cache first, then calls Google API on miss.
 */
export async function getGooglePlaceDetails(
  placeId: string,
  restaurantName?: string,
  restaurantAddress?: string
): Promise<PlaceDetails> {
  const cached = await getGoogleDetailsCached(placeId);
  if (cached) return cached;

  const name = restaurantName ?? "";
  const address = restaurantAddress ?? "";

  const [rawDetails, insights] = await Promise.all([
    fetchGooglePlaceDetails(placeId),
    fetchRestaurantInsights(name, address).catch(() => null),
  ]);
  if (!rawDetails) return EMPTY_DETAILS;

  const details: PlaceDetails = {
    ...rawDetails,
    known_for: insights?.knownFor ?? [],
  };

  await putGoogleDetailsCache(placeId, details).catch((e: unknown) =>
    console.error("[googlePlacesProvider] cache write failed:", e)
  );

  return details;
}
