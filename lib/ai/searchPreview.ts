import type Anthropic from "@anthropic-ai/sdk";
import { getAnthropicClient } from "@/lib/ai/anthropicClient";

export interface RestaurantInsights {
  summary: string;
  knownFor: string[];
  atmosphere: string | null;
  hours: string | null;
  specials: string | null;
  reviews: string | null;
}

const MODEL = "claude-sonnet-4-6";
const MAX_TOKENS = 512;
const MAX_TURNS = 6;

// web_search_20250305 is a server-side Anthropic tool.
// Cast needed as the SDK type union may not yet include this tool variant.
const WEB_SEARCH_TOOL = {
  type: "web_search_20250305",
  name: "web_search",
} as unknown as Anthropic.Tool;

export async function fetchRestaurantInsights(
  name: string,
  address: string
): Promise<RestaurantInsights | null> {
  if (!name || !address) return null;

  const client = getAnthropicClient();

  const prompt = `Search for the restaurant "${name}" at ${address}.

What is it most known for? Reply with ONLY a JSON object — no markdown, no explanation:
{"known_for": ["phrase 1", "phrase 2", "phrase 3"]}

Each phrase should be 2–5 words (e.g., "wood-fired Neapolitan pizza", "lively rooftop bar", "great happy hour deals"). Aim for 3–5 phrases. If you cannot find information about this specific restaurant, return {"known_for": []}.`;

  const messages: Anthropic.MessageParam[] = [{ role: "user", content: prompt }];

  try {
    let response = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      tools: [WEB_SEARCH_TOOL],
      messages,
    });

    // Tool use loop — handles the case where web_search stop_reason requires continuation.
    // For server-side tools, Anthropic injects results; we pass empty content to continue.
    let turns = 0;
    while (response.stop_reason === "tool_use" && turns < MAX_TURNS) {
      turns++;
      messages.push({ role: "assistant", content: response.content });

      const toolResults: Anthropic.ToolResultBlockParam[] = response.content
        .filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use")
        .map((b) => ({
          type: "tool_result" as const,
          tool_use_id: b.id,
          content: "",
        }));

      messages.push({ role: "user", content: toolResults });

      response = await client.messages.create({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        tools: [WEB_SEARCH_TOOL],
        messages,
      });
    }

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]) as { known_for?: unknown };
    const knownFor = Array.isArray(parsed.known_for)
      ? (parsed.known_for as unknown[])
          .filter((v): v is string => typeof v === "string")
          .slice(0, 5)
      : [];

    return {
      summary: "",
      knownFor,
      atmosphere: null,
      hours: null,
      specials: null,
      reviews: null,
    };
  } catch (err) {
    console.error("[searchPreview] Failed to fetch insights:", err);
    return null;
  }
}
