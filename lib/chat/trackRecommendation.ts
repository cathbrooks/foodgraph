import { createClient } from "@/lib/supabase/server";
import type { ScoredRecommendation } from "@/types/recommendation";
import type { BudgetSlot } from "@/types/budget";
import type { Location } from "@/types/restaurant";

interface TrackEventInput {
  userId: string;
  slot: BudgetSlot | null;
  location: Location;
  results: ScoredRecommendation[];
  candidateCount: number;
  filtersApplied: Record<string, unknown>;
}

export async function trackRecommendationEvent(
  input: TrackEventInput
): Promise<string | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("recommendation_events")
    .insert({
      user_id: input.userId,
      slot_id: input.slot?.id ?? null,
      location_lat: input.location.lat,
      location_lng: input.location.lng,
      results: input.results.map((r) => ({
        place_id: r.restaurant.place_id,
        name: r.restaurant.name,
        score: r.score,
        is_wildcard: r.is_wildcard,
      })),
      candidate_count: input.candidateCount,
      filters_applied: input.filtersApplied,
    })
    .select("id")
    .single();

  if (error) {
    console.error("Failed to insert recommendation_event:", error.message);
    return null;
  }

  return data.id;
}
