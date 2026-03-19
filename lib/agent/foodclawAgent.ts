import type { AgentTool } from "@/lib/agent/runner";
import { buildSearchRestaurantsTool, type ToolContext } from "@/lib/agent/tools/searchRestaurants";
import { buildGetRestaurantDetailsTool } from "@/lib/agent/tools/getRestaurantDetails";
import { buildTrackRecommendationTool } from "@/lib/agent/tools/trackRecommendation";

export const FOODCLAW_MODEL = "claude-sonnet-4-6";

export function buildSystemPrompt(
  context: ToolContext,
  sessionRestaurants: Array<{ place_id: string; name: string }>
): string {
  const { activeSlot, preferences, personalization, budgetChoice, customBudgetCeiling, radiusKm } =
    context;

  const slotLine = activeSlot
    ? `${activeSlot.label} ($${activeSlot.min_budget}–$${activeSlot.max_budget}/person)`
    : "None active";

  const cuisineLine =
    preferences?.cuisines?.length ? preferences.cuisines.join(", ") : "Not set";

  const dietaryLine =
    preferences?.dietary_restrictions?.filter((d) => d !== "none").length
      ? preferences.dietary_restrictions.filter((d) => d !== "none").join(", ")
      : "None";

  const hintsLines: string[] = [];
  if (personalization?.preferred_cuisines?.length) {
    hintsLines.push(
      `Historically prefers: ${personalization.preferred_cuisines.slice(0, 3).join(", ")}`
    );
  }
  if (personalization?.avg_selected_price != null) {
    hintsLines.push(`Avg selected price: $${personalization.avg_selected_price}`);
  }
  const hintsLine = hintsLines.length ? hintsLines.join("; ") : "No history yet";

  let budgetContext: string;
  if (budgetChoice === "slot") {
    budgetContext = "The user has selected to use their active budget slot for this session.";
  } else if (budgetChoice === "custom" && customBudgetCeiling) {
    budgetContext = `The user has set a custom budget of under $${customBudgetCeiling}/person.`;
  } else if (budgetChoice === "none") {
    budgetContext = "The user has said budget doesn't matter right now.";
  } else {
    budgetContext =
      "Budget not yet confirmed. If the user wants recommendations, ask casually about their budget before searching — one sentence, not a form.";
  }

  const unitLine = preferences?.distance_unit ?? "km";
  const sessionLine = sessionRestaurants.length
    ? sessionRestaurants.map((r) => `${r.name} (${r.place_id})`).join(", ")
    : "None yet";

  return `You are Foodclaw, a warm and direct restaurant recommendation assistant.

## User Context
- Active budget slot: ${slotLine}
- Cuisine preferences: ${cuisineLine}
- Dietary restrictions: ${dietaryLine}
- Search radius: ${radiusKm} ${unitLine}
- Personalization hints: ${hintsLine}

## Budget Context
${budgetContext}

## Session Restaurants
${sessionLine}

## Rules
- When the user wants restaurant recommendations, call search_restaurants with appropriate parameters.
- When the user asks about a specific restaurant (hours, menu, reviews, etc.), call get_restaurant_details.
- After every search_restaurants call that returns results, call track_recommendation to log the event.
- For follow-up questions, reactions, general food chat, or budget questions, answer conversationally — do not search.
- Keep responses concise. For recommendations, your text is the intro line only — the cards do the visual work.
- Do not fabricate restaurant details. If you don't know, say so.
- The user's location is known — never ask for it.`;
}

export interface FoodclawAgentConfig {
  systemPrompt: string;
  tools: AgentTool[];
  model: string;
}

export function buildFoodclawAgent(
  context: ToolContext,
  sessionRestaurants: Array<{ place_id: string; name: string }>
): FoodclawAgentConfig {
  return {
    systemPrompt: buildSystemPrompt(context, sessionRestaurants),
    tools: [
      buildSearchRestaurantsTool(context),
      buildGetRestaurantDetailsTool(),
      buildTrackRecommendationTool(context),
    ],
    model: FOODCLAW_MODEL,
  };
}
