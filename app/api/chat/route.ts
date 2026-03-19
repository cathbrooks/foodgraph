import { createClient } from "@/lib/supabase/server";
import { ChatRequestSchema } from "@/types/chat";
import { jsonError } from "@/lib/utils/validation";
import { streamAgent, type AgentTool } from "@/lib/agent/runner";
import { buildSystemPrompt, FOODCLAW_MODEL } from "@/lib/agent/foodclawAgent";
import { buildSearchRestaurantsTool, type ToolContext } from "@/lib/agent/tools/searchRestaurants";
import { buildGetRestaurantDetailsTool } from "@/lib/agent/tools/getRestaurantDetails";
import { buildTrackRecommendationTool } from "@/lib/agent/tools/trackRecommendation";
import { resolveActiveSlot } from "@/lib/budgets/slotResolver";
import { getPersonalizationHints } from "@/lib/personalization/personalizationEngine";
import type { ScoredRecommendation } from "@/types/recommendation";
import type { ChatMessage, RecommendationContext, StateUpdates } from "@/types/chat";
import type { UserPreferences } from "@/types/profile";
import type Anthropic from "@anthropic-ai/sdk";

export const maxDuration = 60;

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

  const parsed = ChatRequestSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(
      parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")
    );
  }

  const req = parsed.data;

  try {
    const [activeSlot, prefsResult, personalization] = await Promise.all([
      resolveActiveSlot(user.id, undefined, req.timezone),
      supabase
        .from("user_preferences")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle(),
      getPersonalizationHints(user.id),
    ]);

    const preferences = prefsResult.data as UserPreferences | null;
    const radiusKm = preferences?.travel_radius_km ?? 5;

    const toolContext: ToolContext = {
      userId: user.id,
      location: req.location,
      radiusKm,
      activeSlot,
      preferences,
      personalization,
      budgetChoice: req.budget_choice ?? null,
      customBudgetCeiling: req.custom_budget_ceiling,
    };

    const sessionRestaurants: Array<{ place_id: string; name: string }> =
      req.session_state?.restaurants?.map((r: RecommendationContext) => ({
        place_id: r.place_id,
        name: r.restaurant_name,
      })) ?? [];

    const systemPrompt = buildSystemPrompt(toolContext, sessionRestaurants);

    let capturedResults: ScoredRecommendation[] = [];
    let capturedEventId: string | null = null;

    const searchTool = buildSearchRestaurantsTool(toolContext, (results) => {
      capturedResults = results;
    });

    const rawTrackTool = buildTrackRecommendationTool(toolContext);
    const trackTool: AgentTool = {
      definition: rawTrackTool.definition,
      handler: async (input) => {
        const result = (await rawTrackTool.handler(input)) as { event_id: string | null };
        capturedEventId = result.event_id;
        return result;
      },
    };

    const tools: AgentTool[] = [searchTool, buildGetRestaurantDetailsTool(), trackTool];

    const messages: Anthropic.MessageParam[] = [
      ...req.history.map((h) => ({
        role: h.role as "user" | "assistant",
        content: h.content,
      })),
      { role: "user" as const, content: req.message },
    ];

    const messageId = crypto.randomUUID();
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        function send(data: object) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        }

        try {
          for await (const event of streamAgent({
            messages,
            systemPrompt,
            tools,
            model: FOODCLAW_MODEL,
            maxTurns: 8,
            maxTokens: 4096,
          })) {
            if (event.type === "text_delta") {
              send({ type: "text", delta: event.text });
            } else if (event.type === "done") {
              const text = event.finalContent
                .filter((b): b is Anthropic.TextBlock => b.type === "text")
                .map((b) => b.text)
                .join("");

              const message: ChatMessage = {
                id: messageId,
                role: "assistant",
                content: text,
                recommendations: capturedResults.length > 0 ? capturedResults : null,
                created_at: new Date().toISOString(),
              };

              const stateUpdates: StateUpdates =
                capturedResults.length > 0
                  ? {
                      restaurants: capturedResults.map((r) => ({
                        restaurant_name: r.restaurant.name,
                        place_id: r.restaurant.place_id,
                        cuisine: r.restaurant.cuisines?.[0] ?? null,
                        avg_price: r.restaurant.avg_price_per_person ?? null,
                        rating: r.restaurant.rating ?? null,
                        distance_km: r.restaurant.distance_km ?? null,
                        is_wildcard: r.is_wildcard,
                        explanation: r.explanation,
                      })),
                    }
                  : undefined;

              send({
                type: "done",
                message,
                recommendation_event_id: capturedEventId,
                state_updates: stateUpdates,
              });
            }
          }
        } catch (err) {
          const msg =
            err instanceof Error
              ? err.message
              : "Something went wrong while getting recommendations. Please try again.";
          console.error("[chat route] Stream error:", err);
          send({ type: "error", message: msg });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    console.error("Chat request failed:", err);
    return jsonError(
      "Something went wrong while getting recommendations. Please try again.",
      500
    );
  }
}
