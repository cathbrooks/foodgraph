import type { Restaurant } from "@/types/restaurant";
import type { RestaurantSearchParams } from "./restaurantProvider";
import { searchNearbyRestaurants } from "./restaurantProvider";
import { createClient } from "@/lib/supabase/server";
import { encodeGeohash } from "@/lib/utils/geohash";

const CACHE_TTL_MS = 1000 * 60 * 60; // 1 hour

function buildCacheKey(params: RestaurantSearchParams): string {
  const geohash = encodeGeohash(params.location.lat, params.location.lng, 5);
  const radiusBucket = Math.ceil(params.radiusKm);
  const querySlug = params.query?.toLowerCase().trim().replace(/\s+/g, "_") ?? "";
  return querySlug
    ? `${geohash}:r${radiusBucket}:q${querySlug}`
    : `${geohash}:r${radiusBucket}`;
}

export async function getRestaurantsWithCache(
  params: RestaurantSearchParams
): Promise<Restaurant[]> {
  const cacheKey = buildCacheKey(params);

  try {
    const supabase = await createClient();
    const { data: cached } = await supabase
      .from("restaurant_cache")
      .select("data, expires_at")
      .eq("cache_key", cacheKey)
      .single();

    if (cached && new Date(cached.expires_at) > new Date()) {
      return cached.data as Restaurant[];
    }
  } catch {
    // cache miss or table doesn't exist yet — fall through to provider
  }

  const results = await searchNearbyRestaurants(params);

  if (results.length > 0) {
    try {
      const supabase = await createClient();
      const expiresAt = new Date(Date.now() + CACHE_TTL_MS).toISOString();
      await supabase
        .from("restaurant_cache")
        .upsert(
          {
            cache_key: cacheKey,
            data: results,
            fetched_at: new Date().toISOString(),
            expires_at: expiresAt,
          },
          { onConflict: "cache_key" }
        );
    } catch {
      // cache write failure is non-critical
    }
  }

  return results;
}
