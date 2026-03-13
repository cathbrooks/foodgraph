import type { RecommendationState } from "../state";
import type { ScoredRecommendation } from "@/types/recommendation";
import { getOpenAIClient } from "@/lib/ai/client";
import {
  ExplanationResponseSchema,
  buildExplanationPrompt,
  generateFallbackExplanations,
} from "@/lib/chat/explanationPrompt";
import { withTimeout } from "@/lib/ai/timeout";

const LLM_TIMEOUT_MS = 10_000;

export async function generateExplanations(
  state: RecommendationState
): Promise<Partial<RecommendationState>> {
  const allResults = [
    ...state.scored,
    ...(state.wildcard ? [state.wildcard] : []),
  ];

  let explanations = generateFallbackExplanations(allResults);

  try {
    const llm = getOpenAIClient();
    const prompt = buildExplanationPrompt(
      state.userMessage,
      allResults,
      state.slot
    );

    const response = await withTimeout(
      llm.invoke([{ role: "user", content: prompt }], {
        response_format: { type: "json_object" },
      }),
      LLM_TIMEOUT_MS
    );

    let text =
      typeof response.content === "string"
        ? response.content
        : JSON.stringify(response.content);
    text = text.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");

    const parsed = ExplanationResponseSchema.safeParse(JSON.parse(text));
    if (parsed.success) {
      explanations = parsed.data;
    }
  } catch (err) {
    console.error("generateExplanations LLM failed, using fallback:", err);
  }

  const annotate = (rec: ScoredRecommendation): ScoredRecommendation => {
    const match = explanations.explanations.find(
      (e) => e.place_id === rec.restaurant.place_id
    );
    return match ? { ...rec, explanation: match.explanation } : rec;
  };

  return {
    scored: state.scored.map(annotate),
    wildcard: state.wildcard ? annotate(state.wildcard) : null,
  };
}
