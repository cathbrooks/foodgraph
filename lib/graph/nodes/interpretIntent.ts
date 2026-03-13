import type { RecommendationState } from "../state";
import type { Intent } from "../state";
import { getOpenAIClient } from "@/lib/ai/client";
import { IntentSchema } from "@/lib/ai/schemas/intentSchema";
import { buildIntentSystemPrompt } from "@/lib/ai/prompts/intentPrompt";
import { withTimeout } from "@/lib/ai/timeout";

const LLM_TIMEOUT_MS = 8000;
const FALLBACK_INTENT: Intent = { type: "recommend", constraints: {} };

function normalizeResponse(raw: Record<string, unknown>): Record<string, unknown> {
  if (raw.constraints && typeof raw.constraints === "object") return raw;

  const { type, ...rest } = raw;
  return {
    type,
    constraints: rest,
  };
}

export async function interpretIntent(
  state: RecommendationState
): Promise<Partial<RecommendationState>> {
  try {
    const llm = getOpenAIClient();

    const restaurantNames = (state.sessionState?.restaurants ?? []).map(
      (r) => r.restaurant_name
    );
    const systemPrompt = buildIntentSystemPrompt(restaurantNames);

    const messages: Array<{ role: string; content: string }> = [
      { role: "system", content: systemPrompt },
    ];

    if (state.chatHistory?.length > 0) {
      for (const entry of state.chatHistory) {
        messages.push({ role: entry.role, content: entry.content });
      }
    }

    messages.push({ role: "user", content: state.userMessage });

    const response = await withTimeout(
      llm.invoke(messages, {
        response_format: { type: "json_object" },
      }),
      LLM_TIMEOUT_MS
    );

    const text =
      typeof response.content === "string"
        ? response.content
        : JSON.stringify(response.content);

    const rawJson = JSON.parse(text) as Record<string, unknown>;
    const normalized = normalizeResponse(rawJson);

    const parsed = IntentSchema.safeParse(normalized);
    if (!parsed.success) {
      console.warn("[interpretIntent] schema validation failed, using fallback. Raw:", text, "Issues:", parsed.error.issues);
      return { intent: FALLBACK_INTENT };
    }

    const intent: Intent = {
      type: parsed.data.type,
      constraints: {
        cuisineFilter: parsed.data.constraints.cuisineFilter ?? undefined,
        priceCeiling: parsed.data.constraints.priceCeiling ?? undefined,
        priceFloor: parsed.data.constraints.priceFloor ?? undefined,
        requestedWildcard: parsed.data.constraints.requestedWildcard,
        dietaryFilter: parsed.data.constraints.dietaryFilter ?? undefined,
        targetRestaurant: parsed.data.constraints.targetRestaurant ?? undefined,
        searchQuery: parsed.data.constraints.searchQuery ?? undefined,
      },
    };

    console.log("[interpretIntent] parsed:", JSON.stringify(intent));

    if (intent.type === "unknown") {
      return { intent, earlyExitReason: "UNKNOWN_INTENT" };
    }

    if (
      intent.type === "followup" ||
      intent.type === "ask_detail" ||
      intent.type === "feedback" ||
      intent.type === "general"
    ) {
      return { intent };
    }

    const includeWildcard = intent.constraints.requestedWildcard
      ? true
      : undefined;

    return {
      intent,
      ...(includeWildcard !== undefined && { includeWildcard }),
    };
  } catch (err) {
    console.warn("[interpretIntent] FALLING BACK to empty constraints due to:", err);
    return { intent: FALLBACK_INTENT };
  }
}
