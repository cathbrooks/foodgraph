import type Anthropic from "@anthropic-ai/sdk";
import type { AgentTool } from "@/lib/agent/runner";
import { createClient } from "@/lib/supabase/server";
import type { ToolContext } from "./searchRestaurants";

const definition: Anthropic.Tool = {
  name: "track_recommendation",
  description:
    "Log a recommendation event to analytics. Call this after every search_restaurants call that returns results.",
  input_schema: {
    type: "object" as const,
    properties: {
      results: {
        type: "array",
        description: "The recommended restaurants",
        items: {
          type: "object",
          properties: {
            place_id: { type: "string" },
            name: { type: "string" },
            score: { type: "object" },
            is_wildcard: { type: "boolean" },
          },
          required: ["place_id", "name", "is_wildcard"],
        },
      },
      candidate_count: {
        type: "number",
        description: "Total number of restaurants before filtering",
      },
      filters_applied: {
        type: "object",
        description: "Which filters were active during this search",
        properties: {
          budget: { type: "boolean" },
          open_now: { type: "boolean" },
          max_distance_km: { type: "number" },
          dietary: { type: "array", items: { type: "string" } },
          cuisine_override: { type: "string" },
        },
      },
    },
    required: ["results", "candidate_count"],
  },
};

export function buildTrackRecommendationTool(context: ToolContext): AgentTool {
  return {
    definition,
    handler: async (input) => {
      const results = input.results as Array<{
        place_id: string;
        name: string;
        score?: Record<string, number>;
        is_wildcard: boolean;
      }>;
      const candidate_count = input.candidate_count as number;
      const filters_applied =
        (input.filters_applied as Record<string, unknown>) ?? {};

      try {
        const supabase = await createClient();
        const { data, error } = await supabase
          .from("recommendation_events")
          .insert({
            user_id: context.userId,
            slot_id: context.activeSlot?.id ?? null,
            location_lat: context.location.lat,
            location_lng: context.location.lng,
            results: results.map((r) => ({
              place_id: r.place_id,
              name: r.name,
              score: r.score ?? null,
              is_wildcard: r.is_wildcard,
            })),
            candidate_count,
            filters_applied,
          })
          .select("id")
          .single();

        if (error) {
          console.error("[trackRecommendation] Insert failed:", error.message);
          return { event_id: null };
        }

        return { event_id: data.id };
      } catch (err) {
        console.error("[trackRecommendation] Unexpected error:", err);
        return { event_id: null };
      }
    },
  };
}
