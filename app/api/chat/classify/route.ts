import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOpenAIClient } from "@/lib/ai/client";
import { IntentSchema } from "@/lib/ai/schemas/intentSchema";
import { buildIntentSystemPrompt } from "@/lib/ai/prompts/intentPrompt";
import { withTimeout } from "@/lib/ai/timeout";
import { jsonError } from "@/lib/utils/validation";
import { z } from "zod";

const RequestSchema = z.object({
  user_message: z.string().min(1).max(500),
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() }))
    .max(6)
    .default([]),
  restaurant_names: z.array(z.string()).max(20).default([]),
});

const LLM_TIMEOUT_MS = 4000;

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

  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) return jsonError("Invalid request");

  try {
    const llm = getOpenAIClient();

    const systemPrompt = buildIntentSystemPrompt(parsed.data.restaurant_names);
    const messages: Array<{ role: string; content: string }> = [
      { role: "system", content: systemPrompt },
    ];

    for (const entry of parsed.data.history) {
      messages.push({ role: entry.role, content: entry.content });
    }

    messages.push({ role: "user", content: parsed.data.user_message });

    const response = await withTimeout(
      llm.invoke(messages, { response_format: { type: "json_object" } }),
      LLM_TIMEOUT_MS
    );

    const text =
      typeof response.content === "string"
        ? response.content
        : JSON.stringify(response.content);

    const rawJson = JSON.parse(text) as Record<string, unknown>;

    let normalized = rawJson;
    if (rawJson.constraints && typeof rawJson.constraints === "object") {
      normalized = rawJson;
    } else {
      const { type, ...rest } = rawJson;
      normalized = { type, constraints: rest };
    }

    const intentParsed = IntentSchema.safeParse(normalized);
    if (!intentParsed.success) {
      return NextResponse.json({ type: "recommend", targetRestaurant: null, priceCeiling: null, priceFloor: null });
    }

    return NextResponse.json({
      type: intentParsed.data.type,
      targetRestaurant: intentParsed.data.constraints.targetRestaurant ?? null,
      priceCeiling: intentParsed.data.constraints.priceCeiling ?? null,
      priceFloor: intentParsed.data.constraints.priceFloor ?? null,
    });
  } catch {
    return NextResponse.json({ type: "recommend", targetRestaurant: null, priceCeiling: null, priceFloor: null });
  }
}
