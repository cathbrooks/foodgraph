import type { RecommendationState } from "../state";
import type { ChatMessage, ChatResponse } from "@/types/chat";
import { getOpenAIClient } from "@/lib/ai/client";
import { withTimeout } from "@/lib/ai/timeout";

const LLM_TIMEOUT_MS = 6000;

const EXIT_MESSAGES: Record<string, string> = {
  UNKNOWN_INTENT:
    "Hmm, I'm not sure how to help with that. I'm best at finding restaurants — try asking me for a recommendation like \"I'm craving sushi\" or \"find me something cheap nearby\"!",
  NO_ACTIVE_BUDGET_SLOT:
    "You don't have an active budget slot right now. Set one up in Profile so I can find restaurants that fit your budget.",
  NO_NEARBY_RESTAURANTS:
    "I couldn't find any restaurants near your location. Try increasing your travel radius in Settings.",
  INTERNAL_ERROR:
    "Something went wrong while getting recommendations. Please try again.",
};

function buildNoMatchSystemPrompt(state: RecommendationState): string {
  const constraints = state.intent?.constraints ?? {};
  const parts: string[] = [];

  if (constraints.cuisineFilter) parts.push(`Cuisine: ${constraints.cuisineFilter}`);
  if (constraints.dietaryFilter) parts.push(`Dietary: ${constraints.dietaryFilter}`);
  if (constraints.searchQuery) parts.push(`Search: ${constraints.searchQuery}`);
  if (constraints.priceCeiling != null) parts.push(`Max price: $${constraints.priceCeiling}/person`);
  if (constraints.priceFloor != null) parts.push(`Min price: $${constraints.priceFloor}/person`);

  let budgetLine = "No budget filter applied.";
  if (state.budgetChoice === "slot" && state.slot) {
    budgetLine = `Budget slot: "${state.slot.label}" ($${state.slot.min_budget}–$${state.slot.max_budget}/person)`;
  } else if (state.budgetChoice === "custom" && state.customBudgetCeiling) {
    budgetLine = `Custom budget ceiling: $${state.customBudgetCeiling}/person`;
  }

  const filterSummary = parts.length > 0 ? parts.join(", ") : "No specific filters";

  return `You are Foodclaw, a friendly restaurant recommendation assistant. A search returned zero results.

User's message: "${state.userMessage}"
Filters applied: ${filterSummary}
${budgetLine}

Write a warm, concise response (2-3 sentences) that:
1. Acknowledges you couldn't find anything matching their request
2. Briefly identifies the most likely reason (niche cuisine, tight budget, dietary restriction, etc.)
3. Suggests 1-2 concrete things they could try (e.g. remove the budget limit, try a related cuisine, broaden the search)

Do not make up restaurant names. Be conversational and helpful.`;
}

export async function earlyExit(
  state: RecommendationState
): Promise<Partial<RecommendationState>> {
  const reason = state.earlyExitReason ?? "INTERNAL_ERROR";

  let content = EXIT_MESSAGES[reason] ?? EXIT_MESSAGES.INTERNAL_ERROR;

  if (reason === "NO_MATCHING_RESTAURANTS") {
    try {
      const llm = getOpenAIClient();
      const systemPrompt = buildNoMatchSystemPrompt(state);
      const response = await withTimeout(
        llm.invoke([
          { role: "system", content: systemPrompt },
          { role: "user", content: state.userMessage },
        ]),
        LLM_TIMEOUT_MS
      );
      const llmContent =
        typeof response.content === "string"
          ? response.content
          : String(response.content);
      if (llmContent.trim()) content = llmContent.trim();
    } catch (err) {
      console.warn("[earlyExit] LLM call failed, using fallback:", err);
      content = "I couldn't find restaurants matching your criteria nearby. Try broadening your search, adjusting your budget, or tweaking your filters.";
    }
  }

  const message: ChatMessage = {
    id: crypto.randomUUID(),
    role: "assistant",
    content,
    recommendations: null,
    created_at: new Date().toISOString(),
  };

  const response: ChatResponse = {
    message,
    recommendation_event_id: null,
    state_updates: undefined,
  };

  return { response };
}
