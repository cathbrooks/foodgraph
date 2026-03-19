import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveActiveSlot } from "@/lib/budgets/slotResolver";
import { getRestaurantsWithCache } from "@/lib/restaurants/restaurantCache";
import { filterRestaurants } from "@/lib/restaurants/filters";
import { scoreRestaurants } from "@/lib/scoring/recommendationScorer";
import { selectWildcard } from "@/lib/wildcard/wildcardEngine";
import { getPersonalizationHints } from "@/lib/personalization/personalizationEngine";
import { LocationSchema } from "@/types/restaurant";
import { jsonError } from "@/lib/utils/validation";
import { z } from "zod";

const RecommendRequestSchema = z.object({
  location: LocationSchema,
  include_wildcard: z.boolean().default(false),
  timezone: z.string().optional(),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return jsonError("Unauthorized", 401);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body");
  }

  const parsed = RecommendRequestSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError(
      parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")
    );
  }

  const { location, include_wildcard, timezone } = parsed.data;

  try {
    const [slot, prefsResult, hints] = await Promise.all([
      resolveActiveSlot(user.id, undefined, timezone),
      supabase
        .from("user_preferences")
        .select("*")
        .eq("user_id", user.id)
        .single(),
      getPersonalizationHints(user.id),
    ]);

    const preferences = prefsResult.data;
    const radiusKm = preferences?.travel_radius_km ?? 5;

    const candidates = await getRestaurantsWithCache({ location, radiusKm });

    const filtered = filterRestaurants(candidates, {
      budget: slot,
      preferences,
      maxDistanceKm: radiusKm,
      requireOpenNow: true,
    });

    const scored = scoreRestaurants(filtered, {
      budget: slot,
      preferences,
      userLocationLat: location.lat,
      userLocationLng: location.lng,
      personalization: hints,
    });

    let wildcard = null;
    if (include_wildcard) {
      wildcard = selectWildcard(
        filtered,
        scored.map((s) => s.restaurant),
        preferences
      );
    }

    const all = wildcard ? [wildcard] : scored;

    let eventId: string | null = null;
    try {
      const { data } = await supabase
        .from("recommendation_events")
        .insert({
          user_id: user.id,
          slot_id: slot?.id ?? null,
          location_lat: location.lat,
          location_lng: location.lng,
          results: all.map((r) => ({
            place_id: r.restaurant.place_id,
            name: r.restaurant.name,
            score: r.score,
            is_wildcard: r.is_wildcard,
          })),
          candidate_count: candidates.length,
          filters_applied: {
            budget: !!slot,
            open_now: true,
            max_distance_km: radiusKm,
            dietary: preferences?.dietary_restrictions ?? [],
          },
        })
        .select("id")
        .single();
      eventId = data?.id ?? null;
    } catch (err) {
      console.error("Failed to track recommendation event:", err);
    }

    return NextResponse.json({
      recommendations: all,
      wildcard,
      slot,
      recommendation_event_id: eventId,
    });
  } catch (err) {
    console.error("Recommendation request failed:", err);
    return jsonError(
      "Something went wrong while getting recommendations. Please try again.",
      500
    );
  }
}
