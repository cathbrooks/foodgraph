import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveActiveSlot } from "@/lib/budgets/slotResolver";
import { getRestaurantsWithCache } from "@/lib/restaurants/restaurantCache";
import { filterRestaurants } from "@/lib/restaurants/filters";
import { scoreRestaurants } from "@/lib/scoring/recommendationScorer";
import { selectWildcard } from "@/lib/wildcard/wildcardEngine";
import { getPersonalizationHints } from "@/lib/personalization/personalizationEngine";
import { generateFallbackExplanations } from "@/lib/chat/explanationPrompt";
import { trackRecommendationEvent } from "@/lib/chat/trackRecommendation";
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

    let scored = scoreRestaurants(filtered, {
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
    const explanations = generateFallbackExplanations(all, preferences?.distance_unit);
    scored = all.map((rec) => {
      const match = explanations.explanations.find(
        (e) => e.place_id === rec.restaurant.place_id
      );
      return match ? { ...rec, explanation: match.explanation } : rec;
    });

    let eventId: string | null = null;
    try {
      eventId = await trackRecommendationEvent({
        userId: user.id,
        slot,
        location,
        results: scored,
        candidateCount: candidates.length,
        filtersApplied: {
          budget: !!slot,
          open_now: true,
          max_distance_km: radiusKm,
          dietary: preferences?.dietary_restrictions ?? [],
        },
      });
    } catch (err) {
      console.error("Failed to track recommendation event:", err);
    }

    return NextResponse.json({
      recommendations: scored,
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
