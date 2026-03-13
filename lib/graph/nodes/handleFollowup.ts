import type { RecommendationState } from "../state";
import type {
  ChatMessage,
  ChatResponse,
  RecommendationContext,
  RestaurantDetails,
  SessionState,
  StateUpdates,
} from "@/types/chat";
import type { BudgetSlot } from "@/types/budget";
import { getOpenAIClient } from "@/lib/ai/client";
import { withTimeout } from "@/lib/ai/timeout";
import { resolveActiveSlot } from "@/lib/budgets/slotResolver";

const LLM_TIMEOUT_MS = 8000;

function buildFollowupSystemPrompt(
  session: SessionState | undefined,
  recContext: RecommendationContext[],
  slot: BudgetSlot | null,
  lookedUpDetails: RestaurantDetails | null
): string {
  const allRestaurants = session?.restaurants ?? recContext;

  let restaurantBlock = "No restaurants were recently recommended.";
  if (allRestaurants.length > 0) {
    const lines = allRestaurants.map((r) => {
      const parts = [r.restaurant_name];
      if (r.cuisine) parts.push(`Cuisine: ${r.cuisine}`);
      if (r.avg_price != null) parts.push(`Avg price: $${r.avg_price}/person`);
      if (r.rating != null) parts.push(`Rating: ${r.rating}/5`);
      if (r.distance_km != null) parts.push(`Distance: ${r.distance_km} km`);
      if (r.is_wildcard) parts.push("(wildcard pick)");
      if (r.explanation) parts.push(`Why picked: ${r.explanation}`);
      return `- ${parts.join(" | ")}`;
    });
    restaurantBlock = `Restaurants in this conversation:\n${lines.join("\n")}`;
  }

  let detailsBlock = "";
  const allDetails = { ...(session?.restaurantDetails ?? {}) };
  if (lookedUpDetails) {
    allDetails[lookedUpDetails.place_id] = lookedUpDetails;
  }

  const detailEntries = Object.values(allDetails);
  if (detailEntries.length > 0) {
    const lines = detailEntries.map((d) => {
      const parts = [`**${d.name}**`];
      if (d.summary) parts.push(`Summary: ${d.summary}`);
      if (d.knownFor.length > 0) parts.push(`Known for: ${d.knownFor.join(", ")}`);
      if (d.atmosphere) parts.push(`Atmosphere: ${d.atmosphere}`);
      if (d.hours) parts.push(`Hours: ${d.hours}`);
      if (d.specials) parts.push(`Specials: ${d.specials}`);
      if (d.reviews) parts.push(`Reviews: ${d.reviews}`);
      if (d.website_url) parts.push(`Website: ${d.website_url}`);
      if (d.menu_url) parts.push(`Menu: ${d.menu_url}`);
      return parts.join("\n  ");
    });
    detailsBlock = `\n\nDetailed restaurant information:\n${lines.join("\n\n")}`;
  }

  let selectedBlock = "";
  if (session?.selectedRestaurant) {
    selectedBlock = `\n\nThe user currently has "${session.selectedRestaurant.restaurant_name}" selected.`;
  }

  let budgetBlock = "No budget information available.";
  if (slot) {
    budgetBlock = `User's active budget slot: "${slot.label}" ($${slot.min_budget}–$${slot.max_budget} per person)`;
  }

  return `You are Foodclaw, a friendly restaurant recommendation assistant. The user is asking a follow-up question about restaurants in the conversation.

${restaurantBlock}${detailsBlock}${selectedBlock}

${budgetBlock}

Rules:
- Answer the user's question directly and specifically using the restaurant data above.
- If you have detailed information about a restaurant (hours, atmosphere, reviews, etc.), use it to answer.
- If the user asks about budget, compare the restaurant's avg price to their budget slot.
- If you don't have enough data to answer, say so honestly and suggest they check the restaurant directly.
- Keep responses concise (2-3 sentences max). Be warm and conversational.
- If the user seems to want new recommendations instead, tell them to ask for a new recommendation.
- Do NOT make up information you don't have.`;
}

export async function handleFollowup(
  state: RecommendationState
): Promise<Partial<RecommendationState>> {
  const slot = await resolveActiveSlot(state.userId).catch(() => null);
  const systemPrompt = buildFollowupSystemPrompt(
    state.sessionState,
    state.lastRecommendations,
    slot,
    state.lookedUpDetails ?? null
  );

  const messages: Array<{ role: string; content: string }> = [
    { role: "system", content: systemPrompt },
  ];

  if (state.chatHistory?.length > 0) {
    for (const entry of state.chatHistory) {
      messages.push({ role: entry.role, content: entry.content });
    }
  }

  messages.push({ role: "user", content: state.userMessage });

  let content: string;
  try {
    const llm = getOpenAIClient();
    const response = await withTimeout(llm.invoke(messages), LLM_TIMEOUT_MS);
    content =
      typeof response.content === "string"
        ? response.content
        : String(response.content);
  } catch (err) {
    console.error("[handleFollowup] LLM call failed:", err);
    content =
      "Sorry, I had trouble answering that. Could you rephrase your question, or ask me for a new recommendation?";
  }

  const message: ChatMessage = {
    id: crypto.randomUUID(),
    role: "assistant",
    content,
    recommendations: null,
    created_at: new Date().toISOString(),
  };

  const stateUpdates: StateUpdates = {};
  if (state.lookedUpDetails) {
    stateUpdates.restaurantDetails = {
      [state.lookedUpDetails.place_id]: state.lookedUpDetails,
    };
  }

  const response: ChatResponse = {
    message,
    recommendation_event_id: null,
    state_updates: Object.keys(stateUpdates).length > 0 ? stateUpdates : undefined,
  };

  return { response };
}
