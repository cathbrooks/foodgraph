import { z } from "zod";
import type { ScoredRecommendation } from "@/types/recommendation";
import type { BudgetSlot } from "@/types/budget";

export const ExplanationResponseSchema = z.object({
  explanations: z.array(
    z.object({
      place_id: z.string(),
      explanation: z.string().min(1).max(300),
    })
  ),
});

export type ExplanationResponse = z.infer<typeof ExplanationResponseSchema>;

export function buildExplanationPrompt(
  userMessage: string,
  recommendations: ScoredRecommendation[],
  slot: BudgetSlot | null
): string {
  const recSummaries = recommendations
    .map((r, i) => {
      const s = r.restaurant;
      const score = r.score;
      return [
        `${i + 1}. ${s.name} (place_id: ${s.place_id})`,
        `   Price: ${s.price_level ?? "unknown"} | Rating: ${s.rating ?? "?"}/5 | Distance: ${s.distance_km ?? "?"}km`,
        `   Cuisines: ${s.cuisines.join(", ") || "unknown"}`,
        `   Scores: budget=${score.budget_fit}, cuisine=${score.cuisine_match}, distance=${score.distance}, rating=${score.rating}`,
        r.is_wildcard ? "   [WILDCARD pick]" : "",
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n");

  const budgetContext = slot
    ? `Active budget slot: "${slot.label}" ($${slot.min_budget}–$${slot.max_budget}, ${slot.start_time}–${slot.end_time})`
    : "No active budget slot.";

  return `You are the Foodclaw restaurant assistant. The user asked: "${userMessage}"

${budgetContext}

The scoring engine already ranked these restaurants. DO NOT re-rank them. Your job is to write a short, friendly, one-sentence explanation for EACH restaurant telling the user why it was picked. Reference specific data (price fit, cuisine match, distance, rating) where relevant. For wildcard picks, mention it's a surprise suggestion.

Restaurants:

${recSummaries}

Respond ONLY with valid JSON matching this schema:
{
  "explanations": [
    { "place_id": "...", "explanation": "..." }
  ]
}`;
}

export function generateFallbackExplanations(
  recommendations: ScoredRecommendation[]
): ExplanationResponse {
  return {
    explanations: recommendations.map((r) => {
      const parts: string[] = [];
      const s = r.restaurant;

      if (r.is_wildcard) {
        parts.push("Surprise pick");
      }

      if (r.score.budget_fit >= 0.7) {
        parts.push("great budget fit");
      }
      if (r.score.cuisine_match >= 0.7) {
        parts.push("matches your cuisine preferences");
      }
      if (s.rating != null && s.rating >= 4.0) {
        parts.push(`highly rated (${s.rating}/5)`);
      }
      if (s.distance_km != null && s.distance_km <= 1) {
        parts.push("very close by");
      }

      const explanation =
        parts.length > 0
          ? parts.join(", ").replace(/^./, (c) => c.toUpperCase()) + "."
          : "A solid pick based on your preferences.";

      return { place_id: s.place_id, explanation };
    }),
  };
}
