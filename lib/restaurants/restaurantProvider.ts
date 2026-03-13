import type { Restaurant, Location, PriceLevel } from "@/types/restaurant";
import { distanceKm } from "@/lib/utils/geo";

export interface RestaurantSearchParams {
  location: Location;
  radiusKm: number;
  query?: string;
  maxResults?: number;
}

const FOURSQUARE_BASE_URL = "https://places-api.foursquare.com/places/search";

const FOURSQUARE_CATEGORY_DINING = "13065";
const FOURSQUARE_CATEGORY_FOOD = "13000";

const NON_FOOD_CATEGORY_NAMES = new Set([
  "bar",
  "beer bar",
  "beer garden",
  "cocktail bar",
  "dive bar",
  "hotel bar",
  "lounge",
  "pub",
  "wine bar",
  "nightclub",
  "park",
  "dog park",
  "playground",
  "school",
  "music school",
  "gym",
  "gym / fitness center",
  "church",
  "gas station",
  "parking lot",
  "bank",
  "atm",
  "hospital",
  "doctor's office",
  "dentist's office",
  "pharmacy",
  "post office",
  "laundromat",
  "dry cleaner",
  "car wash",
  "auto repair",
  "boutique",
  "clothing store",
  "apparel",
  "women's store",
  "men's store",
  "shoe store",
  "shoes",
  "jewelry store",
  "jewelry",
  "fashion accessories store",
  "vintage and thrift store",
  "thrift store",
  "department store",
  "sporting goods retail",
  "board store",
  "music venue",
  "bath house",
  "supermarket",
  "grocery store",
  "butcher",
  "hair salon",
  "cosmetics",
  "gift store",
  "laundry",
  "laundry service",
]);

const NON_FOOD_CATEGORY_KEYWORDS = [
  "park",
  "playground",
  "school",
  "gym",
  "fitness",
  "church",
  "temple",
  "mosque",
  "synagogue",
  "gas station",
  "petrol",
  "parking",
  "bank",
  "atm",
  "hospital",
  "doctor",
  "dentist",
  "pharmacy",
  "post office",
  "laundromat",
  "dry cleaner",
  "car wash",
  "auto repair",
  "mechanic",
  "salon",
  "barber",
  "spa",
  "nail salon",
  "real estate",
  "office",
  "library",
  "museum",
  "theater",
  "cinema",
  "stadium",
  "arena",
  "zoo",
  "aquarium",
  "hotel",
  "motel",
  "hostel",
  "campground",
  "storage",
  "moving",
  "plumber",
  "electrician",
  "veterinarian",
  "pet store",
  "kennel",
  "boutique",
  "clothing",
  "apparel",
  "fashion",
  "jewelry",
  "thrift",
  "vintage",
  "shoe store",
  "sporting goods",
  "board store",
  "department store",
  "cosmetics",
  "gift store",
  "grocery",
  "supermarket",
  "butcher",
  "music venue",
  "bath house",
  "laundry",
];

const PRICE_LEVELS: Record<number, PriceLevel> = {
  1: "$",
  2: "$$",
  3: "$$$",
  4: "$$$$",
};

const AVG_PRICE_MAP: Record<string, number> = {
  $: 10,
  $$: 20,
  $$$: 40,
  $$$$: 70,
};

const FOURSQUARE_CORE_FIELDS = [
  "fsq_place_id",
  "name",
  "location",
  "latitude",
  "longitude",
  "categories",
  "distance",
  "website",
].join(",");

const FOURSQUARE_RICH_FIELDS = [
  "rating",
  "price",
  "hours",
  "photos",
  "stats",
].join(",");

const USE_RICH_FIELDS = process.env.FOURSQUARE_RICH_FIELDS !== "false";

const FOURSQUARE_FIELDS = USE_RICH_FIELDS
  ? `${FOURSQUARE_CORE_FIELDS},${FOURSQUARE_RICH_FIELDS}`
  : FOURSQUARE_CORE_FIELDS;

export async function searchNearbyRestaurants(
  params: RestaurantSearchParams
): Promise<Restaurant[]> {
  const apiKey = process.env.FOURSQUARE_API_KEY;
  if (!apiKey || apiKey === "your-foursquare-api-key") {
    console.warn("FOURSQUARE_API_KEY not configured — returning empty results");
    return [];
  }

  const { location, radiusKm, query, maxResults = 50 } = params;
  const radiusMeters = Math.min(Math.round(radiusKm * 1000), 100000);

  const url = new URL(FOURSQUARE_BASE_URL);
  url.searchParams.set("ll", `${location.lat},${location.lng}`);
  url.searchParams.set("radius", String(radiusMeters));
  url.searchParams.set("categories", query ? FOURSQUARE_CATEGORY_FOOD : FOURSQUARE_CATEGORY_DINING);
  url.searchParams.set("limit", String(Math.min(maxResults, 50)));
  url.searchParams.set("fields", FOURSQUARE_FIELDS);

  if (query) {
    url.searchParams.set("query", query);
  }

  const headers = {
    Accept: "application/json",
    Authorization: `Bearer ${apiKey}`,
    "X-Places-Api-Version": "2025-06-17",
  };

  let res: Response;
  try {
    res = await fetch(url.toString(), { method: "GET", headers });
  } catch (err) {
    console.error("Foursquare API network error:", err);
    return [];
  }

  if (res.status === 429 && USE_RICH_FIELDS) {
    console.warn("Foursquare 429 with rich fields — retrying with core-only");
    url.searchParams.set("fields", FOURSQUARE_CORE_FIELDS);
    try {
      res = await fetch(url.toString(), { method: "GET", headers });
    } catch (err) {
      console.error("Foursquare API network error (core retry):", err);
      return [];
    }
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error(`Foursquare API error ${res.status}: ${text}`);
    return [];
  }

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    console.error("Foursquare API returned invalid JSON");
    return [];
  }

  const results = (data as Record<string, unknown>)?.results;
  const places: unknown[] = Array.isArray(results) ? results : [];

  return places
    .filter(isFoodPlace)
    .map((place) => mapFoursquarePlace(place, location));
}

function isFoodPlace(raw: unknown): boolean {
  const place = raw as Record<string, unknown>;
  const categories = place.categories as
    | Array<{ name?: string; short_name?: string }>
    | undefined;
  if (!Array.isArray(categories) || categories.length === 0) return false;

  const names = categories.map(
    (c) => (c.short_name ?? c.name ?? "").toLowerCase()
  );

  if (names.some((n) => NON_FOOD_CATEGORY_NAMES.has(n))) return false;

  if (names.some((n) => NON_FOOD_CATEGORY_KEYWORDS.some((kw) => n.includes(kw)))) {
    return false;
  }

  return true;
}

const DIETARY_KEYWORDS: Record<string, string[]> = {
  vegetarian: ["vegetarian", "veggie"],
  vegan: ["vegan"],
  "gluten-free": ["gluten-free", "gluten free", "celiac"],
  halal: ["halal"],
  kosher: ["kosher"],
  "dairy-free": ["dairy-free", "dairy free", "lactose-free"],
};

function extractDietaryTags(
  categories: Array<{ name?: string; short_name?: string }> | undefined,
  restaurantName: string
): string[] {
  const tags = new Set<string>();
  const searchText = [
    restaurantName,
    ...(categories ?? []).map((c) => c.name ?? c.short_name ?? ""),
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

function mapFoursquarePlace(raw: unknown, userLocation: Location): Restaurant {
  const place = raw as Record<string, unknown>;

  const restaurantLocation: Location = {
    lat: (place.latitude as number) ?? 0,
    lng: (place.longitude as number) ?? 0,
  };

  const fsqId = (place.fsq_place_id as string) ?? "";
  const name = (place.name as string) ?? "Unknown";

  const loc = place.location as Record<string, unknown> | undefined;
  const address =
    (loc?.formatted_address as string) ??
    (loc?.address as string) ??
    "";

  const priceRaw = place.price as number | undefined;
  const priceLevel: PriceLevel | null =
    typeof priceRaw === "number" ? (PRICE_LEVELS[priceRaw] ?? null) : null;
  const avgPrice = priceLevel ? (AVG_PRICE_MAP[priceLevel] ?? null) : null;

  const ratingRaw = place.rating as number | undefined;
  const rating =
    typeof ratingRaw === "number"
      ? Math.round((ratingRaw / 2) * 10) / 10
      : null;

  const categories = place.categories as Array<{ name?: string; short_name?: string }> | undefined;
  const cuisines = Array.isArray(categories)
    ? [
        ...new Set(
          categories
            .flatMap((c) => [c.short_name ?? "", c.name ?? ""])
            .map((n) => n.trim())
            .filter((n) => n !== "" && n.toLowerCase() !== "restaurant")
        ),
      ]
    : [];

  const hours = place.hours as Record<string, unknown> | undefined;
  const isOpenNow =
    typeof hours?.open_now === "boolean" ? hours.open_now : null;

  const distMeters = place.distance as number | undefined;
  const dist =
    typeof distMeters === "number"
      ? Math.round((distMeters / 1000) * 10) / 10
      : restaurantLocation.lat !== 0
        ? Math.round(distanceKm(userLocation, restaurantLocation) * 10) / 10
        : null;

  const stats = place.stats as Record<string, number> | undefined;
  const reviewCount =
    typeof stats?.total_ratings === "number" ? stats.total_ratings : null;

  const photos = place.photos as Array<{ prefix?: string; suffix?: string }> | undefined;
  const firstPhoto = photos?.[0];
  const photoUrl =
    firstPhoto?.prefix && firstPhoto?.suffix
      ? `${firstPhoto.prefix}400x400${firstPhoto.suffix}`
      : null;

  const websiteRaw = place.website;
  const websiteUrl = typeof websiteRaw === "string" && websiteRaw.length > 0
    ? websiteRaw
    : null;

  return {
    id: fsqId,
    place_id: fsqId,
    name,
    address,
    location: restaurantLocation,
    price_level: priceLevel,
    avg_price_per_person: avgPrice,
    rating,
    review_count: reviewCount,
    cuisines,
    dietary_tags: extractDietaryTags(categories, name),
    is_open_now: isOpenNow,
    distance_km: dist,
    photo_url: photoUrl,
    website_url: websiteUrl,
  };
}

export { getGooglePlaceDetails as getPlaceDetails } from "./googlePlacesProvider";
