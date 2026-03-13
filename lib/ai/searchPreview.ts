import OpenAI from "openai";
import { getServerEnv } from "@/lib/env";

export interface RestaurantInsights {
  summary: string;
  knownFor: string[];
  atmosphere: string | null;
  hours: string | null;
  specials: string | null;
  reviews: string | null;
}

let _openai: OpenAI | null = null;

function getClient(): OpenAI {
  if (!_openai) {
    _openai = new OpenAI({ apiKey: getServerEnv().OPENAI_API_KEY });
  }
  return _openai;
}

function buildPrompt(name: string, address: string, websiteUrl?: string): string {
  const websiteLine = websiteUrl ? `\nTheir website is: ${websiteUrl}` : "";
  return `You are a helpful restaurant concierge. Research the restaurant "${name}" located at "${address}".${websiteLine}

Provide a concise, useful summary for someone deciding whether to eat there RIGHT NOW. Return ONLY valid JSON with this exact shape (no markdown fencing):

{
  "summary": "2-3 sentence overview of the restaurant — what it is, why people love it",
  "knownFor": ["dish or trait 1", "dish or trait 2", "dish or trait 3"],
  "atmosphere": "One sentence about the vibe, decor, noise level, or seating",
  "hours": "Today's hours if you can find them, otherwise general hours",
  "specials": "Any current happy hours, deals, or specials — or null if none found",
  "reviews": "A brief 1-2 sentence synthesis of what reviewers say"
}

Rules:
- Be specific and factual. Only include information you actually find.
- If you cannot find info for a field, set it to null (for strings) or [] (for arrays).
- Keep everything concise — this displays on a small card.
- Do NOT wrap the JSON in markdown code fences.`;
}

const TIMEOUT_MS = 10_000;

export async function fetchRestaurantInsights(
  name: string,
  address: string,
  websiteUrl?: string
): Promise<RestaurantInsights | null> {
  const client = getClient();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await client.chat.completions.create(
      {
        model: "gpt-4o-search-preview",
        messages: [{ role: "user", content: buildPrompt(name, address, websiteUrl) }],
      },
      { signal: controller.signal }
    );

    const text = response.choices?.[0]?.message?.content?.trim();
    if (!text) return null;

    const cleaned = text
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    const parsed = JSON.parse(cleaned);

    return {
      summary: typeof parsed.summary === "string" ? parsed.summary : "",
      knownFor: Array.isArray(parsed.knownFor)
        ? parsed.knownFor.filter((s: unknown) => typeof s === "string")
        : [],
      atmosphere: typeof parsed.atmosphere === "string" ? parsed.atmosphere : null,
      hours: typeof parsed.hours === "string" ? parsed.hours : null,
      specials: typeof parsed.specials === "string" ? parsed.specials : null,
      reviews: typeof parsed.reviews === "string" ? parsed.reviews : null,
    };
  } catch (err) {
    if ((err as Error).name === "AbortError") {
      console.warn("Restaurant insights timed out for:", name);
    } else {
      console.error("Restaurant insights failed for:", name, err);
    }
    return null;
  } finally {
    clearTimeout(timer);
  }
}
